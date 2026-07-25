export const LANGUAGE_VERSIONS = {
    'Java': {
        version: '15.0.2',
        snippet: 'class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello Java World!");\n    }\n}',
        mode: 'text/x-java'
    },
    'Python': {
        version: '3.10.0',
        snippet: 'print("Hello Python World!")',
        mode: 'python'
    },
    'JavaScript': {
        version: '18.15.0',
        snippet: 'console.log("Hello JavaScript World!");',
        mode: 'javascript'
    },
    'C++': {
        version: '10.2.0',
        snippet: '#include <iostream>\nusing namespace std;\n\nint main() {\n    cout << "Hello C++ World!" << endl;\n    return 0;\n}',
        mode: 'text/x-c++src'
    },
    'C': {
        version: '10.2.0',
        snippet: '#include <stdio.h>\n\nint main() {\n    printf("Hello C World!\\n");\n    return 0;\n}',
        mode: 'text/x-csrc'
    },
    'TypeScript': {
        version: '5.0.3',
        snippet: 'const message: string = "Hello TypeScript World!";\nconsole.log(message);',
        mode: 'text/typescript'
    },
    'Go': {
        version: '1.16.2',
        snippet: 'package main\n\nimport "fmt"\n\nfunc main() {\n    fmt.Println("Hello Go World!")\n}',
        mode: 'text/x-go'
    },
    'Rust': {
        version: '1.50.0',
        snippet: 'fn main() {\n    println!("Hello Rust World!");\n}',
        mode: 'rust'
    },
    'C#': {
        version: '6.12.0',
        snippet: 'using System;\n\nclass Program {\n    static void Main() {\n        Console.WriteLine("Hello C# World!");\n    }\n}',
        mode: 'text/x-csharp'
    },
    'PHP': {
        version: '8.2.3',
        snippet: '<?php\necho "Hello PHP World!\\n";\n?>',
        mode: 'php'
    },
    'Ruby': {
        version: '3.0.1',
        snippet: 'puts "Hello Ruby World!"',
        mode: 'ruby'
    },
    'Bash': {
        version: '5.2.0',
        snippet: '#!/bin/bash\necho "Hello Bash World!"',
        mode: 'shell'
    },
};