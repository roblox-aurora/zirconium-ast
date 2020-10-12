local TS = require(script.Parent.Parent.CommandLib.vendor.RuntimeLib)
local CommandLib = TS.import(script, script.Parent.Parent, "CommandLib")
local util = CommandLib.astUtility
local prettyPrintNodes = util.prettyPrintNodes


local ZrLexer = CommandLib.ZrLexer
local ZrTextStream = CommandLib.ZrTextStream
local ZrParser = CommandLib.ZrParser

local stream = ZrTextStream.new([[
    $x = 10
    if $x >= 10 { 
        echo "$x is greater than 10!"
    } else {
        echo "$x is less than 10!"
    }
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