local TS = require(game:GetService("ReplicatedStorage").CommandLib.vendor.RuntimeLib)
local zr = TS.import(script, game:GetService("ReplicatedStorage"), "CommandLib")
local prettyPrintNodes = zr.prettyPrintNodes


local ZrLexer = zr.ZrLexer
local ZrTextStream = zr.ZrTextStream
local ZrParser = zr.ZrParser
local ZrVisitors = zr.ZrVisitors

local str = [[
	print "Hello, World!"
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
	version = 1000,
	-- mode = "strict",
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

-- REGION testing

local function visitNode(node)
	if zr.isCallableExpression(node) then
		print("callableExpression", node.expression, node.arguments)
	elseif zr.isVariableStatement(node) then
		local declaration = node.declaration
		print("variableDeclaration", declaration)
	end

	return node
end
local function visitNodeAndChildren(node)
	visitNode(node)
	ZrVisitors.visitEachChild(
		node,
		function(childNode)
			return visitNodeAndChildren(childNode)
		end
	)
end
ZrVisitors.visitEachChild(parsed, function(file)
	visitNodeAndChildren(file)
end)