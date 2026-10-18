// Imported only by the index page's `loader`. The marker string proves the
// module never reaches the client bundle.
const SERVER_ONLY_MARKER = "patties-server-only-marker";

export function readStart(): number {
	return SERVER_ONLY_MARKER.length > 0 ? 3 : 0;
}
