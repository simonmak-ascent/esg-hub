import Link from "next/link";

export default function NotFound() {
  return (
    <div
      className="content-wrapper"
      id="main-content"
      style={{
        textAlign: "center",
        padding: "3rem 1rem",
      }}
    >
      <h1 style={{ borderBottom: "none", fontSize: "2rem" }}>
        Page Not Found
      </h1>
      <p
        style={{
          fontSize: "1.05rem",
          color: "var(--color-text-secondary)",
          maxWidth: "480px",
          margin: "0.5rem auto 1.5rem",
          lineHeight: 1.6,
        }}
      >
        The page you are looking for does not exist or may have been moved.
      </p>
      <div style={{ display: "flex", gap: "1rem", justifyContent: "center", flexWrap: "wrap" }}>
        <Link
          href="/"
          style={{
            display: "inline-block",
            padding: "0.6em 1.5em",
            background: "var(--color-primary)",
            color: "var(--apf-color-text-inverse)",
            borderRadius: 0,
            textDecoration: "none",
            fontFamily: "var(--font-heading)",
            fontWeight: 600,
            fontSize: "0.92rem",
          }}
        >
          Go to Homepage
        </Link>
        <Link
          href="/search"
          style={{
            display: "inline-block",
            padding: "0.6em 1.5em",
            border: "1px solid var(--color-primary)",
            color: "var(--color-primary)",
            borderRadius: 0,
            textDecoration: "none",
            fontFamily: "var(--font-heading)",
            fontWeight: 600,
            fontSize: "0.92rem",
          }}
        >
          Search ESG Hub
        </Link>
      </div>
    </div>
  );
}
