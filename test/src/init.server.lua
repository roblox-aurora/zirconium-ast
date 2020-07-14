local TS = require(script.Parent.CommandLib.vendor.RuntimeLib)
local CommandLib = TS.import(script, script.Parent, "CommandLib")
local CommandAstParser = CommandLib.CommandAstParser
local ast = CommandLib.ast
local CommandAstInterpreter = CommandLib.CommandAstInterpreter

local parsed = CommandAstParser.new([[
    # Regular Commands
    cmd hello there
    cmd "Hello there"
    cmd 'Hello there!!'
    cmd 1337

    cmd --test "Hello, $player!"

    # Cooler Commands
    cmd -kEwL --cool yes
    cmd --something yes -ok cool

    # Binary Expression Commands
    cmd one && cmd --number two
    cmd with-pipe | yes

    # Support Multiline
    cmd one \
        two \
        three

    # Support Interpolated Strings and Variables
    cmd $spartaName
    echo "Hello, $player!"
]]):Parse()
CommandAstParser:prettyPrint({parsed})
print(CommandAstParser:render(parsed))

local exampleCommand = CommandAstInterpreter.new("cmd", {
    {
        name = "test",
        type = "string",
        alias = {"t"}
    }
}, {})
local exampleCommandResult = exampleCommand:interpret(parsed.children[5]) -- cmd --test "Hello, $player!"

local exampleCommand2 = CommandAstInterpreter.new("cmd", {
    {
        name = "something",
        type = "string",
    },
    {
        name = "other",
        alias = {"o"},
        type = "switch"
    },
    {
        name = "kewl",
        alias = {"k"},
        type = "string"
    }
}, {})
local exampleCommandResult2 = exampleCommand2:interpret(parsed.children[7]) -- cmd --something yes -ok cool

function listFor(exampleCommandResult)
   
    for opt, v in pairs(exampleCommandResult.options) do
        print(opt, ast.getKindName(v.kind))
    end

    for i,v in pairs(exampleCommandResult.args) do
        print(i, ast.getKindName(v.kind))
    end
end

listFor(exampleCommandResult) -- Should list "test" and "InterpolatedString"
listFor(exampleCommandResult2) -- Should list "something" and yes, followed by "other" true, then "kewl" cool