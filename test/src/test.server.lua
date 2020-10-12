local TS = require(script.Parent.Parent.CommandLib.vendor.RuntimeLib)
local CommandLib = TS.import(script, script.Parent.Parent, "CommandLib")
local util = CommandLib.astUtility
local prettyPrintNodes = util.prettyPrintNodes


local ZrLexer = CommandLib.ZrLexer
local ZrTextStream = CommandLib.ZrTextStream
local ZrParser = CommandLib.ZrParser

local stream = ZrTextStream.new([[
    echo "Hello, World!" 10 true
    echo "This is $variable" "This is $sparta!!! lol"
]])
local lexer = ZrLexer.new(stream)


while lexer:hasNext() do
    local v = lexer:next()
    if v then
        print(v.kind, game:GetService("HttpService"):JSONEncode(v))
    end
end

-- lexer:reset()

-- local parser = ZrParser.new(lexer)
-- local parsed = parser:parse()

-- prettyPrintNodes({parsed}, nil, false)