Command AST
==============
**A**bstract **S**yntax **T**ree generator for commands on Roblox.

## Supported Syntaxes
- Comments 
    ```bash
    # example comment
    ```
- Basic commands - 
    ```bash
    cmd hello world
    cmd "Hello, World!"
    ```

- Multiple commands
    ```bash
    cmd one
    cmd two
    cmd three
    ```
    ```bash
    cmd one; cmd two; cmd three
    ```

- Multi-line commands
    ```bash
    cmd one \
        two \
        three
    ```

- Options
    ```bash
    cmd -kEwL --options yes
    ```
- Variables 
    ```bash
    cmd $var 
    ```
- String Interpolation 
    ```bash
    cmd "Interpolated $value string"
    ```
- Synchronous Execution
    ```bash
    cmd1 arg && cmd2 arg
    ```
- Pipes
    ```bash
    cmd1 | cmd2
    ```
- Prefixes
    ```bash
    cmd1 ~value @value %value ^value *value`
    ```
- Variable Declarations
    ```bash
    $var = 10
    $var = string
    $var = "a string"
    $var = $anotherVar
    $var = "Interpolated $value string"
    ```

## Ast Examples
Simplified via `CommandAstParser.prettyPrint`

- Regular commands:

    `cmd hello world`

    ```
    CommandStatement {
        CommandName cmd
        String `hello`
        String `world`
    }
    ```
    
    `cmd "Hello, World!"`

    ```
    CommandStatement {
        CommandName cmd
        String "Hello, World!"
    }
    ```

- Options

    `cmd -kEwL --options yes`

    ```
    CommandStatement {
       CommandName cmd
       Option k
       Option E
       Option w
       Option L
       Option options
       String `yes` 
    }
    ```

- Synchronous binary expression

    `cmd one && cmd --number two`

    ```
    BinaryExpression {
        CommandStatement {
            CommandName cmd
            String `one`
        }
        OperatorToken "&&"
        CommandStatement {
            CommandName cmd
            Option number
            String `two`
        }
    }
    ```

- Pipe binary expression

    `cmd one | cmd --number two`

    ```
    BinaryExpression {
        CommandStatement {
            CommandName cmd
            String `one`
        }
        OperatorToken "|"
        CommandStatement {
            CommandName cmd
            Option number
            String `two`
        }
    }
    ```

- Variable usage

    `cmd $variable`

    ```
    CommandStatement {
        CommandName cmd
        Identifier variable
    }
    ```

    `cmd "string interpolation $ohYeaaah!"`

    ```
    CommandStatement {
        CommandName cmd
        InterpolatedString {
            String "string interpolation "
            Identifier ohYeaaah
            String "!"
        }
    }
    ```

- Prefix expressions

    `cmd @special`

    ```
    CommandStatement {
        CommandName cmd
        PrefixExpression {
            Prefix "@"
            String `special`
        }
    }
    ```

- Variable declarations

    `$var = 10`

    ```
    VariableDeclarationStatement {
        VariableDeclaration {
            Identifier var
            NumberLiteral 10
        }
    }
    ```

    `$var = "Hello, World!"`

    ```
    VariableDeclarationStatement {
        VariableDeclaration {
            Identifier var
            String "Hello, World!"
        }
    }
    ```

    `$var = "Hello $otherVar!"`

    ```
    VariableDeclarationStatement {
        VariableDeclaration {
            Identifier var
            InterpolatedString {
                String "Hello "
                Identifier otherVar
                String "!"
            }
        }
    }
    ```