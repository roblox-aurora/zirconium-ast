Command AST
==============
**A**bstract **S**yntax **T**ree generator for commands on Roblox.

## Supported
- Regular commands:

    `cmd hello world` - cmd; hello; world
    
    `cmd "Hello, World!"` - cmd; Hello, World!

- Options

    `cmd -kEwL --options yes`

- Variables

    `cmd $variable`

    `cmd "Hello, $player!"` (string interpolation)

- Binary Expressions

    `cmd1 && cmd2` (run one command after another)

    `cmd | echo` (run command with output of previous command)

- Misc
    Supports multi-line commands, also can separate command statements with a semicolon (`;`)