local TS = require(script.Parent.Parent.CommandLib.vendor.RuntimeLib)
local CommandLib = TS.import(script, script.Parent.Parent, "CommandLib")
local util = CommandLib.astUtility
local prettyPrintNodes = util.prettyPrintNodes


local ZrLexer = CommandLib.ZrLexer
local ZrTextStream = CommandLib.ZrTextStream
local ZrParser = CommandLib.ZrParser

local stream = ZrTextStream.new([[
    $index = $myArray.0
    $prop = $myObject.prop
    $index2 = $myObject.array.0
    $prop2 = $myObject.prop.innerProp
]])
local lexer = ZrLexer.new(stream)


while lexer:hasNext() do
    local v = lexer:next()
    if v then
        print(v.kind, game:GetService("HttpService"):JSONEncode(v))
    end
end

lexer:reset()

local parser = ZrParser.new(lexer, {
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
local parsed = parser:parse()

prettyPrintNodes({parsed}, nil, false)