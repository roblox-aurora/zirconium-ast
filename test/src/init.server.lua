local TS = require(script.Parent.CommandLib.vendor.RuntimeLib)
local CommandLib = TS.import(script, script.Parent, "CommandLib")
local CommandAstParser = CommandLib.CommandAstParser
local ast = CommandLib.ast
local util = CommandLib.astUtility
local prettyPrintNodes = util.prettyPrintNodes
local CommandAstInterpreter = CommandLib.CommandAstInterpreter

local parsed = CommandAstParser.new({
    prefixExpressions = true,
    variableDeclarations = true,
    innerExpressions = true,
    -- invalidCommandIsError = false,
    nestingInnerExpressions = true,
    commands = {
        { command = "cmd" },
        { command = "main", children = {
            { 
                command = "sub", 
                options = {
                    test = { type = {"string", "number"} }
                }
            }
        }}
    }
}):Parse([[
    # Subcommand testing
    cmd test
    main sub yes --test hello
    main sub --test true
]])


print(CommandAstParser:render(parsed))
prettyPrintNodes({parsed}, nil, true)
CommandAstParser:assert(parsed)
