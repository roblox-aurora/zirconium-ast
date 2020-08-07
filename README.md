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

- Nested Expressions
    ```bash
    cmd $(cmd2 -k xyz)
    $var = $(cmd2 -k xyz)
    ```

## Validation
Validation is done via `CommmandAstParser.validate` - and returns an object, depending on the value of `success`.

```ts
type ValidationSuccess = { success: true }
type ValidationError = { success: false, errorNodes: NodeError[] }
```

`errorNodes` is an array of errors, which are
```ts
interface NodeError {
	node: Node;
	message: string;
}
```

Through this, you can get information about what nodes are causing errors, by using `node.startPos` and `node.endPos` for the position of the offending text, and `message` for the error message.

Inside `CommandAstParser` there is a simple `assert` function that is like the following:

```ts
assert(node: Node) {
    const result = this.validate(node);
    if (!result.success) {
        const firstNode = result.errorNodes[0];
        throw `[CmdParser] [${firstNode.node.startPos ?? 0}:${firstNode.node.endPos ?? 0}] ${firstNode.message}`;
    }
}
```

Which will, for example in the case of 
```bash
$x=
```
will give
```diff
- [CmdParser] [3:3] Expression expected: '$x ='
```
Which means at character 3, (`=`) there is an error - in this case, there is no expression.


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

- Inner Expressions

    `cmd $(cmd2 --something else)`
    ```
    CommandStatement {
        CommandName cmd
        InnerExpression {
            CommandStatement {
                CommandName cmd2
                Option something
                String else
            }
        }
    }
    ```

    `$var = $(cmd xyz)`

    ```
    VariableDeclarationStatement {
        VariableDeclaration {
            Identifier var
            InnerExpression {
                CommandStatement {
                    CommandName cmd
                    String `xyz`
                }
            }
        }
    }
    ```