import * as vscode from 'vscode';

const alltestRe  = /\s*void .*\(\)\s*/g;
const testLineRe = /^\s*void .*\(\)\s*/;
const headingRe  = /\s*TEST\s*GROUP.*$/;
const commentRe  = /\/\*([\s\S]*?)\*\/\s*|\s*\/\/.*\n*/g; // /g for multiple matches

export const parseTestsFile = (text: string, events: {
  onTest(range: vscode.Range, a: string): void;
  onHeading(range: vscode.Range, name: string, depth: number): void;
}) => {

    var uncmtLines = text.replace(commentRe, "\n");
    var testNames  = uncmtLines.match(alltestRe); 
    if (testNames) {
        for (let i = 0; i < testNames.length; i++) {
            testNames[i] = testNames[i].trim();
        }
    }   
    
    const lines = text.split('\n');
    
    for (let lineNo = 0; lineNo < lines.length; lineNo++) {
        const line = lines[lineNo];
        const test = testLineRe.exec(line);   
        if (test) {
            var tMatch = test[0].trim();
            if (!testNames?.find(e => e === tMatch)) { continue; }
            const name = tMatch.split("(")[0].split(" ")[1];                    
            const range = new vscode.Range(new vscode.Position(lineNo, 0), new vscode.Position(lineNo, test[0].length));
            events.onTest(range, name);      
            continue;
        }

        const heading = headingRe.exec(line);    
        if (heading) {      
            const headingname = heading[0];      
            const range = new vscode.Range(new vscode.Position(lineNo, 0), new vscode.Position(lineNo, line.length));
            events.onHeading(range, headingname, headingname.length);
        }
    }   
};
