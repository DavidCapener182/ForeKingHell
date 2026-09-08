import { createRoot } from "react-dom/client";
import { useImportFiles } from "@/app/import/use-import-files";
import { Button } from "@/components/ui/button";
const mapping = {};
function Fixture() {
  const files = useImportFiles("yards", mapping);
  return (
    <main className="grid gap-4 p-4">
      <h1>Mixed import parser fixture</h1>
      <p>Isolated hook fixture with one deliberately failing parser file.</p>
      <label>
        Choose CSV files
        <input
          type="file"
          multiple
          accept=".csv"
          onChange={(event) => void files.readSelectedFiles(event.target.files ?? [])}
        />
      </label>
      <p role="status">
        {files.isParsing ? "Parsing" : `${files.parsedFiles.length} valid previews`}
      </p>
      <ul>
        {files.parsedFiles.map((file) => (
          <li key={file.id}>
            {file.fileName} · {file.parsed.shots.length} shots
          </li>
        ))}
      </ul>
      {files.parseError ? <p role="alert">{files.parseError}</p> : null}
      {files.parseFailures.map((file) => (
        <Button key={file.id} onClick={() => files.removeFile(file.id)}>
          Remove {file.fileName}
        </Button>
      ))}
      <Button disabled={files.isParsing || !!files.parseError || !files.parsedFiles.length}>
        Save preview
      </Button>
    </main>
  );
}
createRoot(document.getElementById("root")!).render(<Fixture />);
