import * as React from "react";

export default function Alpha() {
	const [n, setN] = React.useState(0);
	return (
		<button type="button" onClick={() => setN(n + 1)}>
			alpha {n}
		</button>
	);
}
