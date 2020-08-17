local TS = require(script.Parent.CommandLib.vendor.RuntimeLib)
local CommandLib = TS.import(script, script.Parent, "CommandLib")
local CommandAstParser = CommandLib.CommandAstParser
local ast = CommandLib.ast
local util = CommandLib.astUtility
local prettyPrintNodes = util.prettyPrintNodes
local CommandAstInterpreter = CommandLib.CommandAstInterpreter

local parser = CommandAstParser.new({
    prefixExpressions = true,
    variableDeclarations = true,
    innerExpressions = true,
    -- invalidCommandIsError = false,
    nestingInnerExpressions = true,
    commands = {
        { command = "void" },
        { 
            command = "cmd1", 
            args = {
                { 
                    type = {"string"}
                }
            } 
        },
        { command = "cmd2", children = {
            { 
                command = "sub", 
                options = {
                    test = { type = {"string", "number"} }
                },
                args = {
                    {type = {"string"} }
                }
            }
        }}
    }
})

local parsed = parser:Parse([[
    # Subcommand testing
    # cmd1 "Hello $playerName!"
    # cmd2 sub test --test hello
    # cmd2 sub --test true
]]);


print(CommandAstParser:render(parsed))
prettyPrintNodes({parsed}, nil, true)
CommandAstParser:assert(parsed, parser:GetSource())
