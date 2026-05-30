export const island = false as const;

export interface HelloProps {
	name?: string;
}

export function Hello({ name = "world" }: HelloProps) {
	return <p data-testid="hello">{`Hello, ${name}!`}</p>;
}
