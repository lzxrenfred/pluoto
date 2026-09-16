export default function MobilePreview() {
  return (
    <main style={{ width: "100vw", height: "100vh", display: "grid", placeItems: "center", background: "#dce7ec" }}>
      <iframe
        title="Pluoto mobile preview"
        src="/"
        style={{ width: 390, height: 844, border: 0, borderRadius: 28, boxShadow: "0 24px 70px rgba(20,40,60,.25)", background: "#93d5fb" }}
      />
    </main>
  );
}
