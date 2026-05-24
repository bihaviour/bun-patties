import * as React from "react"

export default function Beta() {
  const [s, setS] = React.useState("")
  return <input value={s} onChange={(e) => setS(e.target.value)} />
}
