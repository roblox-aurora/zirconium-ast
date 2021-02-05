local TS = require(game:GetService("ReplicatedStorage").CommandLib.vendor.RuntimeLib)
local CommandLib = TS.import(script, game:GetService("ReplicatedStorage"), "CommandLib")
local util = CommandLib.astUtility
local prettyPrintNodes = util.prettyPrintNodes


local ZrLexer = CommandLib.ZrLexer
local ZrTextStream = CommandLib.ZrTextStream
local ZrParser = CommandLib.ZrParser

local str = [[
	$x = undefined
]];
local stream = ZrTextStream.new(str)
local lexer = ZrLexer.new(stream)


while lexer:hasNext() do
    local v = lexer:next()
    if v then
        if v.startPos and v.endPos then
            print(v.kind, "{" .. string.sub(str, v.startPos, v.endPos) .. "}")
        else
            print(v.kind, game:GetService("HttpService"):JSONEncode(v))
        end
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
local parsed = parser:parseOrThrow()

prettyPrintNodes({parsed}, nil, false)