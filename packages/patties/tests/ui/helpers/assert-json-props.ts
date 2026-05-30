export function assertJsonProps<T extends object>(
	label: string,
	props: T,
): void {
	let serialized: string;
	try {
		serialized = JSON.stringify(props);
	} catch (err) {
		throw new Error(
			`${label}: props are not JSON-serializable (${err instanceof Error ? err.message : String(err)})`,
		);
	}
	if (serialized === undefined) {
		throw new Error(`${label}: props serialized to undefined`);
	}
	let parsed: unknown;
	try {
		parsed = JSON.parse(serialized);
	} catch (err) {
		throw new Error(
			`${label}: round-trip parse failed (${err instanceof Error ? err.message : String(err)})`,
		);
	}
	if (JSON.stringify(parsed) !== serialized) {
		throw new Error(`${label}: round-trip mismatch`);
	}
}
