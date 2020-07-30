import CommandRegistry from "./CommandRegistry";
import CommandAstParser, { CommandAstInterpreter } from "@rbxts/cmd-ast";

export default class CommandDispatch {
	constructor(private readonly registry: CommandRegistry) {}
	evaluate(text: string, executor: Player) {
		// We'll parse the command
		const parsed = new CommandAstParser(text).Parse();

		// create an interpreter
		const interpreter = new CommandAstInterpreter(
			this.registry.getCommands().map((f) => f.getCommandDeclaration()),
		);

		// Now intepret the input, and provide results!
		const results = interpreter.interpret(parsed, { player: executor });
		for (const result of results) {
			if (CommandAstInterpreter.isCommand(result)) {
				const matchingCommand = this.registry.getCommands().find((c) => c.command === result.command);
				if (matchingCommand) {
					const returned = matchingCommand.executeForPlayer(result.options, result.args, executor);
				}
			}
		}
	}
}
