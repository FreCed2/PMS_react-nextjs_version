const fs = require('fs');
const path = require('path');
const acorn = require('acorn');
const walk = require('acorn-walk');

function extractVariablesFromFile(filepath) {
    const content = fs.readFileSync(filepath, 'utf-8');
    const ast = acorn.parse(content, { ecmaVersion: 'latest' });

    const variables = {
        globals: new Set(),
        functions: {}
    };

    // Helper function to add variables to the appropriate scope
    function addVariable(name, scope) {
        if (scope === 'global') {
            variables.globals.add(name);
        } else {
            if (!variables.functions[scope]) {
                variables.functions[scope] = new Set();
            }
            variables.functions[scope].add(name);
        }
    }

    // Walk the AST
    walk.fullAncestor(ast, (node, ancestors) => {
        const parent = ancestors[ancestors.length - 2];
        const grandparent = ancestors[ancestors.length - 3];

        switch (node.type) {
            case 'VariableDeclarator':
                const scope = parent.kind === 'var' && grandparent.type === 'Program' ? 'global' : 'function';
                addVariable(node.id.name, scope);
                break;

            case 'FunctionDeclaration':
                if (node.id && node.id.type === 'Identifier') {
                    addVariable(node.id.name, 'global');
                }
                break;

            case 'FunctionExpression':
            case 'ArrowFunctionExpression':
                // Handle function parameters
                node.params.forEach(param => {
                    if (param.type === 'Identifier') {
                        addVariable(param.name, 'function');
                    }
                });
                break;
        }
    });

    return variables;
}

function extractVariablesFromDirectory(directory) {
    const allVariables = {
        globals: new Set(),
        functions: {}
    };

    function mergeVariables(newVars) {
        newVars.globals.forEach(globalVar => allVariables.globals.add(globalVar));
        for (const [funcName, vars] of Object.entries(newVars.functions)) {
            if (!allVariables.functions[funcName]) {
                allVariables.functions[funcName] = new Set();
            }
            vars.forEach(v => allVariables.functions[funcName].add(v));
        }
    }

    const files = fs.readdirSync(directory);
    files.forEach(file => {
        const filepath = path.join(directory, file);
        if (fs.lstatSync(filepath).isDirectory()) {
            mergeVariables(extractVariablesFromDirectory(filepath));
        } else if (file.endsWith('.js')) {
            console.log(`Processing ${filepath}`);
            mergeVariables(extractVariablesFromFile(filepath));
        }
    });

    return allVariables;
}

function saveVariablesToFile(variables, outputFile) {
    const output = [];

    output.push('Global Variables:\n');
    output.push([...variables.globals].sort().join('\n'));

    output.push('\nFunction Variables:\n');
    for (const [func, vars] of Object.entries(variables.functions)) {
        output.push(`${func}:\n  ${[...vars].sort().join('\n  ')}`);
    }

    fs.writeFileSync(outputFile, output.join('\n'), 'utf-8');
    console.log(`Variables saved to ${outputFile}`);
}

// Example usage
const directoryToScan = '/Users/fredrik_cederborg/CodingProjects/pythonProject/app/static/js'; // Change to your JS code directory
const outputFile = 'js_variables.txt';
const variables = extractVariablesFromDirectory(directoryToScan);
saveVariablesToFile(variables, outputFile);

