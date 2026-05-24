import type { PattiesContext } from "../../../../../../src/middleware/index.ts";

export default function Hotel({ city }: { city: string }) {
	return <h1>City: {city}</h1>;
}

export const __probeCity = (ctx: PattiesContext) => ctx.params.city;
