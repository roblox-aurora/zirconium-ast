local TS = require(script.Parent.Parent.CommandLib.vendor.RuntimeLib)
local CommandLib = TS.import(script, script.Parent.Parent, "CommandLib")
local util = CommandLib.astUtility
local prettyPrintNodes = util.prettyPrintNodes


local ZrLexer = CommandLib.ZrLexer
local ZrTextStream = CommandLib.ZrTextStream
local ZrParser = CommandLib.ZrParser

local str = [[
    # Normal command
    cmd hello "Hello World" 10 true
    cmd("hello", "Hello, World!", 10, true)

    # Array
    cmd [ "Hello, World!" 10 true ]
    cmd([ "Hello, World!", 10, true ])

    # Options
    cmd --option 10 "HIIII"

    # Assignment
    $aNumber = 10
    $aBoolean = true
    $aString = "Hello, World!"

    # Access
    $H = $aString.0
    $name = $player.Name

    # If/Else
    if $value {
        do_the_thing
    }

    if $value {
        do_the_thing
    } else {
        do_the_other_thing
    }

    if $value {
        do_the_thing
    } else if $value2 {
        do_the_other_thing
    } else {
        do_the_other_other_thing
    }
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