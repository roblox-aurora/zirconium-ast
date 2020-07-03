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