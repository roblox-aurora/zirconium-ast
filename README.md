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


## Structures
Here are some examples of the generated AST (simplified using `CommandAstParser.prettyPrint`)

Basic statement: `echo "Hello, World!"`
```
CommandStatement {
    CommandName echo
    String "Hello, World!"
}
```

Optioned Statement: `cmd -kEwL --cool yes`
```
CommandStatement {
    CommandName cmd
    Option k
    Option E
    Option w
    Option L
    Option cool
    String "yes"
}
```


BinaryExpression Statement: `cmd one && cmd --number two`
```
BinaryExpression {
    operator: "&&"
    CommandStatement {
        CommandName cmd
        String "one"
    }
    CommandStatement {
        CommandName cmd
        Option number
        String "two"
    }
}
```

InterpolatedStringExpression Statement: `echo "Hello, $player!"`

```
CommandStatement {
    CommandName echo
    InterpolatedString {
        String "Hello,"
        Identifier player
        String "!"
    }
}
```