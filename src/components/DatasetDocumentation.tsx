import type { ReactNode } from 'react';
import { ExternalLink, X } from 'lucide-react';

interface DatasetDocumentationProps {
  onClose: () => void;
}

const GITHUB_URL = 'https://github.com/GustavoWMSilva/MapGeospatialMobilityData';
const DEMO_VIDEO_URL = 'https://youtu.be/WxX65v-qDuk';
const JSDELIVR_GITHUB_URL = 'https://www.jsdelivr.com/github';
const CDN_EXAMPLE_URL =
  'https://cdn.jsdelivr.net/gh/GustavoWMSilva/MapGeospatialMobilityData@main/public/data/meu_dataset/processed/';

const odColumns = [
  { name: 'origin_code', type: 'texto', description: 'codigo da area de origem' },
  { name: 'dest_code', type: 'texto', description: 'codigo da area de destino' },
  { name: 'count', type: 'numero inteiro', description: 'volume de deslocamentos entre origem e destino' },
  { name: 'origin_name', type: 'texto opcional', description: 'nome da origem' },
  { name: 'dest_name', type: 'texto opcional', description: 'nome do destino' },
] as const;

const cdnSteps = [
  {
    title: '1. Organize os arquivos no repositorio',
    description:
      'Crie uma pasta em public/data/<dataset_id>/ com processed para Parquets e lookup para CSV/GeoJSON auxiliares.',
    example: 'public/data/meu_dataset/processed/flows.parquet',
  },
  {
    title: '2. Suba os arquivos para o GitHub',
    description:
      'O repositorio precisa estar publico para o jsDelivr acessar os arquivos. Depois do push, confirme se o arquivo abre no GitHub.',
    example: 'https://github.com/usuario/repositorio/tree/main/public/data/meu_dataset',
  },
  {
    title: '3. Monte a URL base do jsDelivr',
    description:
      'Troque usuario, repositorio, versao e caminho. A versao pode ser main durante testes, mas tags/releases sao melhores para reproducibilidade.',
    example: 'https://cdn.jsdelivr.net/gh/usuario/repositorio@main/public/data/meu_dataset/processed/',
  },
  {
    title: '4. Teste cada arquivo publicado',
    description:
      'Abra a URL completa no navegador. Se o download nao iniciar ou aparecer erro 404, revise nome, extensao, maiusculas/minusculas e caminho.',
    example: 'https://cdn.jsdelivr.net/gh/usuario/repositorio@main/public/data/meu_dataset/processed/flows.parquet',
  },
  {
    title: '5. Cole a URL no perfil JSON',
    description:
      'Use a pasta processed em storage.remoteBaseUrl e informe apenas o nome do arquivo em baseFlowDataset.fileName.',
    example: '"remoteBaseUrl": "https://cdn.jsdelivr.net/gh/usuario/repositorio@main/public/data/meu_dataset/processed/"',
  },
] as const;

const requiredFiles = [
  {
    title: 'Matriz origem-destino',
    format: 'CSV, XLSX ou Parquet',
    path: 'processed/flows.parquet',
    structure: 'origin_code, dest_code, count, origin_name, dest_name',
    types: 'texto, texto, numero inteiro, texto opcional, texto opcional',
    description:
      'Arquivo principal de fluxos. O app usa Parquet para leitura principal no DuckDB-WASM, mas a simulacao aceita CSV ou Parquet.',
  },
  {
    title: 'Centroides da unidade base',
    format: 'CSV',
    path: 'lookup/areas_centroids.csv',
    structure: 'code, name, lat, lon',
    types: 'texto, texto, numero decimal, numero decimal',
    description: 'Pontos representativos usados para posicionar areas e desenhar linhas de fluxo.',
  },
  {
    title: 'Limites da unidade base',
    format: 'GeoJSON',
    path: 'lookup/boundaries.geojson',
    structure: 'FeatureCollection com Polygon ou MultiPolygon e propriedade de codigo/nome',
    types: 'geometria em WGS84, propriedades textuais',
    description: 'Poligonos das unidades territoriais detalhadas exibidas no mapa.',
  },
  {
    title: 'Lookup agregado',
    format: 'CSV',
    path: 'lookup/aggregate_lookup.csv',
    structure: 'base_code, base_name, aggregate_code, aggregate_name',
    types: 'texto, texto, texto, texto',
    description: 'Tabela que relaciona unidade base e unidade agregada, por exemplo setor -> bairro ou MSOA -> LTLA.',
  },
  {
    title: 'Centroides da unidade agregada',
    format: 'CSV',
    path: 'lookup/aggregate_centroids.csv',
    structure: 'code, name, lat, lon',
    types: 'texto, texto, numero decimal, numero decimal',
    description: 'Pontos representativos das areas agregadas usadas no modo resumido.',
  },
  {
    title: 'Limites da unidade agregada',
    format: 'GeoJSON',
    path: 'lookup/aggregate_boundaries.geojson',
    structure: 'FeatureCollection com Polygon ou MultiPolygon e propriedade de codigo/nome',
    types: 'geometria em WGS84, propriedades textuais',
    description: 'Poligonos das areas agregadas, como bairros, municipios, LTLAs ou regioes equivalentes.',
  },
  {
    title: 'Dimensoes demograficas opcionais',
    format: 'Parquet',
    path: 'processed/flows_<categoria>.parquet',
    structure: 'origin_code, dest_code, count, category',
    types: 'texto, texto, numero inteiro, texto',
    description: 'Arquivos separados para idade, ocupacao, classe social ou outras categorias usadas em filtros e graficos.',
  },
] as const;

const profileExample = `{
  "id": "meu_dataset",
  "label": "Meu dataset",
  "geography": {
    "base": "Setor Censitario",
    "aggregate": "Bairro"
  },
  "storage": {
    "remoteBaseUrl": "${CDN_EXAMPLE_URL}",
    "localProcessedBasePath": "/data/meu_dataset/processed/"
  },
  "baseFlowDataset": {
    "fileName": "flows.parquet",
    "tableName": "flows"
  }
}`;

const documentationSections = [
  { id: 'doc-links', label: 'Links uteis' },
  { id: 'doc-contract', label: 'Matriz OD' },
  { id: 'doc-files', label: 'Arquivos' },
  { id: 'doc-cdn', label: 'Publicar no CDN' },
  { id: 'doc-profile', label: 'Perfil JSON' },
  { id: 'doc-tools', label: 'Uso nas ferramentas' },
  { id: 'doc-care', label: 'Cuidados' },
] as const;

export function DatasetDocumentation({ onClose }: DatasetDocumentationProps) {
  const scrollToSection = (sectionId: string) => {
    document.getElementById(sectionId)?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  };

  return (
    <div className="fixed inset-0 z-[75] flex items-center justify-center bg-slate-950/40 px-4 py-6 backdrop-blur-sm">
      <section className="flex max-h-full w-full max-w-[980px] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Ferramentas</p>
            <h2 className="text-lg font-bold text-slate-950">Documentacao para novos dados</h2>
            <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-500">
              Guia rapido para preparar uma matriz origem-destino, publicar arquivos estaticos e criar um perfil
              reutilizavel na ferramenta.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-slate-200 text-slate-600 transition-colors hover:bg-slate-100"
            title="Fechar documentacao"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 overflow-y-auto overflow-x-hidden px-5 py-4">
          <div className="grid min-w-0 gap-4 lg:grid-cols-[160px_minmax(0,1fr)]">
            <aside className="lg:sticky lg:top-0 lg:self-start">
              <nav className="rounded-xl border border-slate-200 bg-slate-50 p-2">
                <p className="px-2 pb-2 pt-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                  Ir para
                </p>
                <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-1">
                  {documentationSections.map((section) => (
                    <button
                      key={section.id}
                      type="button"
                      onClick={() => scrollToSection(section.id)}
                      className="rounded-md px-2.5 py-2 text-left text-xs font-semibold text-slate-600 transition-colors hover:bg-white hover:text-slate-950"
                    >
                      {section.label}
                    </button>
                  ))}
                </div>
              </nav>
            </aside>

            <div className="grid min-w-0 gap-4">
            <DocumentationCard id="doc-links" title="Links uteis">
              <div className="grid gap-3 md:grid-cols-2">
                <ExternalResource
                  title="Codigo no GitHub"
                  description="Repositorio com o frontend, pipeline, perfis e exemplos de datasets."
                  href={GITHUB_URL}
                />
                <ExternalResource
                  title="Video de demonstracao"
                  description="Demonstra o uso da interface, selecao de areas, filtros, graficos e ferramentas."
                  href={DEMO_VIDEO_URL}
                />
              </div>
            </DocumentationCard>

            <DocumentationCard id="doc-contract" title="1. Contrato minimo da matriz OD">
              <p className="text-xs leading-5 text-slate-600">
                Cada linha representa uma relacao entre uma area de origem e uma area de destino. Os codigos precisam
                bater com os codigos dos centroides e dos limites geograficos.
              </p>
              <div className="mt-3 overflow-hidden rounded-lg border border-slate-200">
                {odColumns.map((column) => (
                  <div
                    key={column.name}
                    className="grid grid-cols-[120px_110px_minmax(0,1fr)] border-b border-slate-100 last:border-b-0"
                  >
                    <code className="bg-slate-50 px-3 py-2 text-[11px] font-semibold text-slate-900">
                      {column.name}
                    </code>
                    <span className="bg-slate-50 px-3 py-2 text-[11px] font-semibold text-slate-500">
                      {column.type}
                    </span>
                    <span className="px-3 py-2 text-[11px] text-slate-600">{column.description}</span>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-[11px] leading-4 text-slate-500">
                Trate codigos territoriais como texto para preservar zeros a esquerda e evitar diferencas entre CSV,
                Parquet e GeoJSON. O campo <code className="rounded bg-slate-100 px-1">count</code> deve ser numerico e
                sem separador de milhar.
              </p>
            </DocumentationCard>

            <DocumentationCard id="doc-files" title="2. Arquivos de um dataset completo">
              <div className="space-y-2">
                {requiredFiles.map((file) => (
                  <div key={file.title} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <p className="text-xs font-bold text-slate-900">{file.title}</p>
                      <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                        {file.format}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] leading-4 text-slate-500">{file.description}</p>
                    <div className="mt-2 grid gap-2 rounded-md bg-white p-2">
                      <FileMetadata label="Caminho comum" value={file.path} />
                      <FileMetadata label="Colunas/estrutura" value={file.structure} />
                      <FileMetadata label="Tipos" value={file.types} />
                    </div>
                  </div>
                ))}
              </div>
            </DocumentationCard>

            <DocumentationCard id="doc-cdn" title="3. Como publicar no CDN">
              <p className="text-xs leading-5 text-slate-600">
                Uma forma simples e deixar os arquivos em um repositorio publico do GitHub e acessar pelo jsDelivr. No
                projeto, os Parquets ficam em <code className="rounded bg-slate-100 px-1">processed</code> e os CSV/GeoJSON
                auxiliares em <code className="rounded bg-slate-100 px-1">lookup</code>.
              </p>
              <div className="mt-3">
                <ExternalResource
                  title="Guia oficial do jsDelivr para GitHub"
                  description="Pagina do jsDelivr sobre como converter links do GitHub para URLs CDN."
                  href={JSDELIVR_GITHUB_URL}
                />
              </div>
              <div className="mt-3 space-y-2">
                {cdnSteps.map((step) => (
                  <div key={step.title} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs font-bold text-slate-900">{step.title}</p>
                    <p className="mt-1 text-[11px] leading-4 text-slate-500">{step.description}</p>
                    <code className="mt-2 block break-all rounded-md bg-white px-2.5 py-2 text-[10px] leading-4 text-slate-600">
                      {step.example}
                    </code>
                  </div>
                ))}
              </div>
              <CodeBlock>{CDN_EXAMPLE_URL}</CodeBlock>
              <p className="mt-3 text-[11px] leading-4 text-slate-500">
                Para reproducibilidade, prefira trocar <code className="rounded bg-slate-100 px-1">@main</code> por uma
                tag ou release quando o dataset estiver fechado para avaliacao. Evite depender de arquivos que ainda
                mudam no branch principal, porque a mesma URL pode passar a apontar para outro conteudo.
              </p>
            </DocumentationCard>

            <DocumentationCard id="doc-profile" title="4. Perfil JSON">
              <p className="text-xs leading-5 text-slate-600">
                O perfil informa nomes exibidos na interface, caminhos dos arquivos, filtros e graficos habilitados. Ele
                pode ser criado pelo Assistente de perfil OD.
              </p>
              <CodeBlock>{profileExample}</CodeBlock>
            </DocumentationCard>

            <DocumentationCard id="doc-tools" title="5. Como usar nas ferramentas">
              <div className="space-y-3 text-xs leading-5 text-slate-600">
                <p>
                  Use <strong>Criar dataset por JSON</strong> quando quiser cadastrar uma nova geografia completa, com
                  matriz, centroides, limites e lookup.
                </p>
                <p>
                  Use <strong>Aplicar matriz OD personalizada</strong> quando a geografia ja existe no app e voce quer
                  testar outra matriz ou uma simulacao sobre os mesmos codigos territoriais.
                </p>
                <p>
                  Os perfis e simulacoes salvos localmente ficam no navegador por IndexedDB/localStorage. Eles aparecem
                  no seletor sem recompilar o projeto.
                </p>
              </div>
            </DocumentationCard>

            <DocumentationCard id="doc-care" title="6. Cuidados importantes">
              <ul className="list-disc space-y-2 pl-4 text-xs leading-5 text-slate-600">
                <li>As geometrias devem estar em WGS84 para funcionar corretamente no mapa web.</li>
                <li>As linhas ligam centroides e nao representam o trajeto real percorrido.</li>
                <li>Filtros demograficos so funcionam quando os arquivos possuem as categorias configuradas.</li>
                <li>Arquivos muito grandes podem aumentar tempo de download, consulta e renderizacao.</li>
                <li>Todos os arquivos publicados precisam estar acessiveis por URL publica ou por caminhos em public/data.</li>
              </ul>
            </DocumentationCard>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function ExternalResource({
  title,
  description,
  href,
}: {
  title: string;
  description: string;
  href: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="flex min-w-0 items-start justify-between gap-4 rounded-lg border border-slate-200 bg-slate-50 p-3 transition-colors hover:border-slate-300 hover:bg-white"
    >
      <span className="min-w-0">
        <span className="block text-xs font-bold text-slate-950">{title}</span>
        <span className="mt-1 block text-[11px] leading-4 text-slate-500">{description}</span>
        <span className="mt-2 block break-all font-mono text-[10px] text-slate-400">{href}</span>
      </span>
      <ExternalLink className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
    </a>
  );
}

function DocumentationCard({ id, title, children }: { id?: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="min-w-0 scroll-mt-4 rounded-xl border border-slate-200 bg-white p-4">
      <h3 className="mb-3 text-sm font-bold text-slate-950">{title}</h3>
      {children}
    </section>
  );
}

function FileMetadata({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 sm:grid-cols-[120px_minmax(0,1fr)]">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</span>
      <code className="break-words font-mono text-[11px] leading-4 text-slate-700">{value}</code>
    </div>
  );
}

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="mt-3 max-h-64 whitespace-pre-wrap break-words rounded-lg bg-slate-950 p-3 text-[11px] leading-5 text-slate-100">
      <code>{children}</code>
    </pre>
  );
}
