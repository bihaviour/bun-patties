"use client";

import { useState } from "react";

export default function Counter(): JSX.Element {
	const [n, setN] = useState(0);
	return (
		<button type="button" onClick={() => setN(n + 1)}>
			clicked {n} times
		</button>
	);
}
