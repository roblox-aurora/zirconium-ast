<center>
    <img src="https://assets.vorlias.com/i1/zirconium-ast.png"/>
</center>

# Zirconium AST
Lexer and Parser for the Zirconium DSL (Domain-specific Language) for use in Roblox.
More information in the [Zirconium project](https://github.com/roblox-aurora/zirconium).

### _Note: Documentation is WIP as the new parser is written_

## Features
### Using commands
```bash
command hello 10 true "Hello there $playerName!" # simple call
command("hello", 10, true, "Hello there $playerName!") # explicit call
```
A simple call is for quick & easy commands (and more like a command), explicit calls allow passing other commands as arguments and is more explicit and akin to regular programming.

- I'm possibly planning with Zircon that certain commands require 'explicit'

### Using Variables
```bash
$aNumber = 10
$aString = "Hello there!"
$aBoolean = true
```

### Using arrays
```bash
$arrayVariable = [ "string", true, 10, 5.5, "combined $variable string" ] #variable use
kill [ vorlias, augmin ]
kill([ "vorlias", "augmin" ])
```

### Using Pipes and Synchronous calls
```bash
command | command2 # Passes values from command to command2
command && command2 # Meant to only execute command2 if command succeeds
command || command2 # Meant to only execute command2 if command fails
```
Explicit calls can also be used with these.