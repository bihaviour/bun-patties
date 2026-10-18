export const hydrate = true;
export const meta = { title: "User" };

export default function User({ id }: { id: string }) {
	return <h1>user {id}</h1>;
}
