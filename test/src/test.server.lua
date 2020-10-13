local TS = require(script.Parent.Parent.CommandLib.vendor.RuntimeLib)
local CommandLib = TS.import(script, script.Parent.Parent, "CommandLib")
local util = CommandLib.astUtility
local prettyPrintNodes = util.prettyPrintNodes


local ZrLexer = CommandLib.ZrLexer
local ZrTextStream = CommandLib.ZrTextStream
local ZrParser = CommandLib.ZrParser

local stream = ZrTextStream.new([[
    $arrayExample = [ 1337, true, hello, "Hello there", "Hello $playerName!", false, 42, $value $value.otherValue ]
    command([ "Hello there", 3.5 ], 'hello', 'there')
    command [ "Hello there" 3.5 ] hello there
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