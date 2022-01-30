import * as vscode from 'vscode';


const testRe    = /^\s*void .*\(\).*/;
const headingRe = /\s*TEST\s*GROUP.*$/;
const commentRe = /\/\*([\s\S]*?)\*\/\s*/g; // /g for multiple matches

export const parseTestsFile = (text: string, events: {
  onTest(range: vscode.Range, a: string): void;
  onHeading(range: vscode.Range, name: string, depth: number): void;
}) => {
    var cmtdLines      =  text.match(commentRe);
    var cmtdLineString = '';
    if (cmtdLines) { 
        cmtdLineString = cmtdLines.join(' ');
    }
    
    const lines = text.split('\n');
    
    for (let lineNo = 0; lineNo < lines.length; lineNo++) {
        const line = lines[lineNo];
        const test = testRe.exec(line);
        console.log(test);       
        if (test && !cmtdLineString.includes(test[0])) {     
            var tname = test[0];
            while (tname[0] === ' ') {
                tname = tname.slice(1);
            } 
            const name = tname.split("(")[0].split(" ")[1];                    
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
