import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import * as plist from 'plist';

enum Language {
    cpp2 = "cpp2",
}

enum Extension {
    TmLanguage = "tmLanguage",
    YamlTmLanguage = "YAML-tmLanguage",
}

function file(prefix: string, language: Language, extension: Extension) {
    return path.join(prefix, `${language}.${extension}`);
}
function inputFile(language: Language, extension: Extension) {
    return file('src', language, extension);
}
function outputFile(language: Language, extension: Extension) {
    return file('syntaxes', language, extension);
}

function writePlistFile(grammar: TmGrammar, fileName: string) {
    const text = plist.build(grammar);
    fs.writeFileSync(fileName, text);
}

function readYaml(fileName: string) {
    const text = fs.readFileSync(fileName, "utf8");
    return yaml.load(text);
}

function transformGrammarRule(rule: any, propertyNames: string[], transformProperty: (ruleProperty: string) => string) {
    for (const propertyName of propertyNames) {
        const value = rule[propertyName];
        if (typeof value === 'string') {
            rule[propertyName] = transformProperty(value);
        }
    }

    for (var propertyName in rule) {
        const value = rule[propertyName];
        if (typeof value === 'object') {
            transformGrammarRule(value, propertyNames, transformProperty);
        }
    }
}

function transformGrammarRepository(grammar: TmGrammar, propertyNames: string[], transformProperty: (ruleProperty: string) => string) {
    const repository = grammar.repository;
    for (let key in repository) {
        transformGrammarRule(repository[key], propertyNames, transformProperty);
    }
}

function getCpp2Grammar(getVariables: (grammarVariables: MapLike<string>) => MapLike<string>) {
    const grammarBeforeTransformation = readYaml(inputFile(Language.cpp2, Extension.YamlTmLanguage)) as TmGrammar;
    return updateGrammarVariables(grammarBeforeTransformation, getVariables(grammarBeforeTransformation.variables as MapLike<string>));
}

function replacePatternVariables(pattern: string, variableReplacers: VariableReplacer[]) {
    let result = pattern;
    for (const [variableName, value] of variableReplacers) {
        result = result.replace(variableName, value);
    }
    return result;
}

type VariableReplacer = [RegExp, string];
function updateGrammarVariables(grammar: TmGrammar, variables: MapLike<string>) {
    delete grammar.variables;
    const variableReplacers: VariableReplacer[] = [];
    for (const variableName in variables) {
        // Replace the pattern with earlier variables
        const pattern = replacePatternVariables(variables[variableName], variableReplacers);
        variableReplacers.push([new RegExp(`{{${variableName}}}`, "gim"), pattern]);
    }
    transformGrammarRepository(
        grammar,
        ["begin", "end", "match"],
        pattern => replacePatternVariables(pattern, variableReplacers)
    );
    return grammar;
}

function buildGrammar() {
    const grammar = getCpp2Grammar(grammarVariables => grammarVariables);

    // Write Cpp2.tmLanguage
    fs.mkdirSync('syntaxes', { recursive: true });
    writePlistFile(grammar, outputFile(Language.cpp2, Extension.TmLanguage));
}

buildGrammar();