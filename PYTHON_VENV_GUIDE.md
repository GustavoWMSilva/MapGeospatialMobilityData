# Guia de Ambiente Virtual Python

## 🐍 Configuração do Ambiente Virtual (venv)

### ✅ Ambiente já criado e configurado!

### 📦 Dependências Python Instaladas:

- **pandas** - Manipulação de dados
- **pyarrow** - Leitura eficiente de arquivos
- **duckdb** - Banco de dados analítico
- **geopandas** - Análise de dados geoespaciais
- **shapely** - Geometrias espaciais
- **pyyaml** - Leitura de arquivos YAML

---

## 🚀 Como Usar o Ambiente Virtual

### **No Git Bash (Windows):**

#### Ativar o venv:

```bash
source venv/Scripts/activate
```

#### Desativar o venv:

```bash
deactivate
```

### **No PowerShell (Windows):**

#### Ativar o venv:

```powershell
.\venv\Scripts\Activate.ps1
```

#### Desativar o venv:

```powershell
deactivate
```

### **No CMD (Windows):**

#### Ativar o venv:

```cmd
venv\Scripts\activate.bat
```

#### Desativar o venv:

```cmd
deactivate
```

---

## 📝 Comandos Úteis

### Verificar pacotes instalados:

```bash
pip list
```

### Instalar novo pacote:

```bash
pip install nome-do-pacote
```

### Atualizar requirements.txt:

```bash
pip freeze > requirements.txt
```

### Reinstalar todas as dependências:

```bash
pip install -r requirements.txt
```

---

## 🔧 Estrutura do Projeto

```
meu-projeto-tailwind/
├── venv/                    # ← Ambiente virtual Python (não sobe pro Git)
├── src/                     # ← Código React/TypeScript
├── node_modules/            # ← Dependências JavaScript
├── requirements.txt         # ← Dependências Python
├── package.json            # ← Dependências JavaScript
└── .gitignore              # ← Configurado para ignorar venv/
```

---

## ⚠️ Importante

- **Sempre ative o venv** antes de executar scripts Python
- O venv **não é versionado** no Git (está no .gitignore)
- Outros desenvolvedores devem criar seu próprio venv com:
  ```bash
  python -m venv venv
  source venv/Scripts/activate  # ou activate conforme o terminal
  pip install -r requirements.txt
  ```

---

## 🎯 Workflow Típico

1. **Ativar o venv:**

   ```bash
   source venv/Scripts/activate
   ```

2. **Executar script Python:**

   ```bash
   python seu_script.py
   ```

3. **Quando terminar:**
   ```bash
   deactivate
   ```

---

## 🌐 Para o Projeto React

As dependências JavaScript continuam sendo gerenciadas separadamente:

```bash
# Instalar dependências JavaScript
npm install

# Rodar projeto React
npm run dev
```
