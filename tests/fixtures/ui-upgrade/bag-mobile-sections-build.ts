import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import type { Plugin } from "esbuild";

/** Expose actual pure page sections for browser QA without bundling server loaders.
 * No markup/classes are copied or rewritten: only unused server declarations/imports are omitted.
 */
export function bagMobileSectionsPlugin(): Plugin {
  return {
    name: "actual-bag-page-sections",
    setup(builder) {
      builder.onResolve({ filter: /^bag-page-mobile-sections$/ }, () => ({
        path: path.resolve("src/app/(app)/bag/page.tsx"),
        namespace: "bag-sections",
      }));
      builder.onLoad({ filter: /.*/, namespace: "bag-sections" }, ({ path: file }) => {
        const source =
          process.env.FKH_BAG_BASELINE === "1"
            ? execFileSync(
                "git",
                ["show", "def1951194bb33806025b9bb9390b5112a61314f:src/app/(app)/bag/page.tsx"],
                { encoding: "utf8" },
              )
            : readFileSync(file, "utf8");
        const ast = ts.createSourceFile(
          file,
          source,
          ts.ScriptTarget.Latest,
          true,
          ts.ScriptKind.TSX,
        );
        const page = ast.statements.find(
          (statement): statement is ts.FunctionDeclaration =>
            ts.isFunctionDeclaration(statement) && statement.name?.text === "BagWorkbenchPage",
        )!;
        const statements = [...page.body!.statements];
        const start = statements.findIndex((statement) =>
          statement
            .getText(ast)
            .startsWith("const { bag, benchmarkRows, intelligence } = benchmarkMode"),
        );
        const body = statements
          .slice(start)
          .filter(
            (statement) => !statement.getText(ast).startsWith("const peerBenchmarkSummary ="),
          );
        const inputs =
          "benchmarkMode, profile, featureData, speedSummary, equipmentContext, quickBagClubs, accountId, preferences, activeTab, resolvedSearchParams, peerBenchmarkSummary, peerBenchmarksLoaded, surface";
        const view = ts.createSourceFile(
          "view.tsx",
          `function BagMobilePage({ ${inputs} }) { ${body.map((statement) => statement.getText(ast)).join("\n")} }`,
          ts.ScriptTarget.Latest,
          true,
          ts.ScriptKind.TSX,
        ).statements[0];
        const declarations = new Map<string, ts.Statement>([["BagMobilePage", view]]);
        for (const statement of ast.statements) {
          if (ts.isFunctionDeclaration(statement) && statement.name)
            declarations.set(statement.name.text, statement);
          if (ts.isVariableStatement(statement))
            for (const declaration of statement.declarationList.declarations)
              if (ts.isIdentifier(declaration.name))
                declarations.set(declaration.name.text, statement);
        }
        const exports = [
          "BagMobilePage",
          "buildGappingRows",
          "BagConfidenceLadder",
          "BagHealthHero",
          "BagSupportingEvidence",
          "CarryGappingTable",
          "BenchmarkReferencePanel",
        ];
        const wanted = new Set(exports);
        const selected = new Set<ts.Statement>();
        const references = (node: ts.Node) => {
          if (ts.isTypeNode(node)) return;
          if (ts.isIdentifier(node)) wanted.add(node.text);
          ts.forEachChild(node, references);
        };
        for (const name of wanted) {
          const statement = declarations.get(name);
          if (statement && !selected.has(statement)) {
            selected.add(statement);
            references(statement);
          }
        }
        const imports: string[] = [];
        for (const statement of ast.statements) {
          if (!ts.isImportDeclaration(statement) || !statement.importClause) continue;
          const clause = statement.importClause;
          const parts: string[] = [];
          if (clause.name && wanted.has(clause.name.text)) parts.push(clause.name.text);
          if (clause.namedBindings && ts.isNamedImports(clause.namedBindings)) {
            const names = clause.namedBindings.elements.filter(
              (entry) => !entry.isTypeOnly && wanted.has(entry.name.text),
            );
            if (names.length)
              parts.push(`{ ${names.map((entry) => entry.getText(ast)).join(", ")} }`);
          }
          if (parts.length)
            imports.push(
              `import ${parts.join(", ")} from ${statement.moduleSpecifier.getText(ast)};`,
            );
        }
        return {
          contents: [
            ...imports,
            ...[...selected].map((statement) =>
              statement === view ? statement.getText() : statement.getText(ast),
            ),
            `export { ${exports.join(", ")} };`,
          ].join("\n"),
          loader: "tsx",
          resolveDir: path.dirname(file),
        };
      });
    },
  };
}
