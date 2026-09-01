import os
import re
import urllib.request
import urllib.parse
import json
import time

TARGET_DIR = r"C:\Users\arief\Downloads\sumber\jurnal"
os.makedirs(TARGET_DIR, exist_ok=True)

headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}

journals = [
    {
        "id": 1,
        "filename": "Bjarnason_2023_Software_Prototyping.pdf",
        "title": "An empirically based model of software prototyping: a mapping study and a multi-case study",
        "doi": "10.1007/s10664-023-10331-w",
        "urls": [
            "https://link.springer.com/content/pdf/10.1007/s10664-023-10331-w.pdf"
        ]
    },
    {
        "id": 2,
        "filename": "Bolanowski_2022_Efficiency_REST_gRPC_Microservices.pdf",
        "title": "Efficiency of REST and gRPC Realizing Communication Tasks in Microservice-Based Ecosystems",
        "doi": "10.3233/FAIA220242",
        "urls": [
            "https://ebooks.iospress.nl/volumearticle/60786"
        ]
    },
    {
        "id": 3,
        "filename": "Chase_2023_LangChain_Repository.pdf",
        "title": "LangChain GitHub Repository",
        "urls": [
            "https://raw.githubusercontent.com/langchain-ai/langchain/master/README.md"
        ]
    },
    {
        "id": 4,
        "filename": "Chu_2016_Data_Cleaning_SIGMOD.pdf",
        "title": "Data Cleaning: Overview and Emerging Challenges",
        "doi": "10.1145/2882903.2912574",
        "urls": [
            "https://sanjaykrishnan.org/papers/sigmod16.pdf",
            "https://db.cs.cmu.edu/papers/2016/chu-sigmod2016.pdf"
        ]
    },
    {
        "id": 5,
        "filename": "Cote_2024_Data_Cleaning_Machine_Learning_SLR.pdf",
        "title": "Data Cleaning and Machine Learning: A Systematic Literature Review",
        "doi": "10.1007/s10515-024-00453-w",
        "urls": [
            "https://link.springer.com/content/pdf/10.1007/s10515-024-00453-w.pdf",
            "https://arxiv.org/pdf/2403.01353.pdf"
        ]
    },
    {
        "id": 6,
        "filename": "Dakic_2025_Container_Security_Development.pdf",
        "title": "The role of container security in application development",
        "doi": "10.55214/25768484.v9i1.4382",
        "urls": [
            "https://eadas.org/index.php/east/article/download/4382/3854"
        ]
    },
    {
        "id": 7,
        "filename": "Febrian_2024_KemenkeuGPT.pdf",
        "title": "KemenkeuGPT: Leveraging a Large Language Model on Indonesia's Government Financial Data",
        "doi": "10.48550/arXiv.2407.21459",
        "urls": [
            "https://arxiv.org/pdf/2407.21459.pdf"
        ]
    },
    {
        "id": 8,
        "filename": "Haq_2024_SoK_Docker_Container_Security.pdf",
        "title": "SoK: A Comprehensive Analysis and Evaluation of Docker Container Attack and Defense Mechanisms",
        "doi": "10.1109/sp54263.2024.00268",
        "urls": [
            "https://arxiv.org/pdf/2311.13963.pdf"
        ]
    },
    {
        "id": 9,
        "filename": "Healy_2018_Data_Visualization.pdf",
        "title": "Data Visualization: A Practical Introduction",
        "urls": [
            "https://socviz.co/"
        ]
    },
    {
        "id": 10,
        "filename": "Kang_2024_Exploiting_Programmatic_Behavior_LLMs.pdf",
        "title": "Exploiting Programmatic Behavior of LLMs: Dual-Use Through Standard Security Attacks",
        "doi": "10.1109/SPW63631.2024.00018",
        "urls": [
            "https://arxiv.org/pdf/2402.11754.pdf"
        ]
    },
    {
        "id": 11,
        "filename": "Ke_2023_Cognitive_Load_Visualized_Dashboards.pdf",
        "title": "Effect of information load and cognitive style on cognitive load of visualized dashboards",
        "doi": "10.1016/j.autcon.2023.105029",
        "urls": []
    },
    {
        "id": 12,
        "filename": "Kohn_2022_DuckDB_Wasm.pdf",
        "title": "DuckDB-Wasm: Efficient Analytical Query Processing in the Browser",
        "doi": "10.14778/3554821.3554847",
        "urls": [
            "https://www.vldb.org/pvldb/vol15/p3562-kohn.pdf"
        ]
    },
    {
        "id": 13,
        "filename": "Lazaros_2026_Human_In_The_Loop_AI.pdf",
        "title": "Human-in-the-Loop Artificial Intelligence: A Systematic Review",
        "doi": "10.3390/e28040377",
        "urls": [
            "https://www.mdpi.com/1099-4300/26/4/377/pdf"
        ]
    },
    {
        "id": 14,
        "filename": "Li_2024_LLM_for_Data_Management.pdf",
        "title": "LLM for Data Management",
        "doi": "10.14778/3685800.3685838",
        "urls": [
            "https://www.vldb.org/pvldb/vol17/p4213-li.pdf"
        ]
    },
    {
        "id": 15,
        "filename": "McKinney_2022_Python_for_Data_Analysis.pdf",
        "title": "Python for Data Analysis (3rd ed.)",
        "urls": [
            "https://wesmckinney.com/book/"
        ]
    },
    {
        "id": 16,
        "filename": "Pressman_2020_Software_Engineering.pdf",
        "title": "Software Engineering: A Practitioner’s Approach (9th ed.)",
        "urls": []
    },
    {
        "id": 17,
        "filename": "Putatunda_2019_SmartEDA_R_Package.pdf",
        "title": "SmartEDA: An R Package for Automated Exploratory Data Analysis",
        "doi": "10.21105/joss.01509",
        "urls": [
            "https://www.thejoss.in/papers/10.21105/joss.01509.pdf"
        ]
    },
    {
        "id": 18,
        "filename": "Sarikaya_2019_What_Do_We_Talk_About_Dashboards.pdf",
        "title": "What do we talk about when we talk about dashboards?",
        "doi": "10.1109/tvcg.2018.2864903",
        "urls": [
            "https://arxiv.org/pdf/1803.07629.pdf"
        ]
    },
    {
        "id": 19,
        "filename": "Schick_2023_Toolformer.pdf",
        "title": "Toolformer: Language Models Can Teach Themselves to Use Tools",
        "doi": "10.1162/tacl_a_00576",
        "urls": [
            "https://arxiv.org/pdf/2302.04761.pdf"
        ]
    },
    {
        "id": 20,
        "filename": "Sharda_2018_Business_Intelligence_Analytics.pdf",
        "title": "Business Intelligence, Analytics, and Data Science: A Managerial Perspective (4th ed.)",
        "urls": []
    },
    {
        "id": 21,
        "filename": "Shen_2018_Challenges_Learning_UML.pdf",
        "title": "Challenges in Learning Unified Modeling Language",
        "doi": "10.17705/1CAIS.04330",
        "urls": [
            "https://aisel.aisnet.org/cgi/viewcontent.cgi?article=3378&context=cais"
        ]
    },
    {
        "id": 22,
        "filename": "Sumers_2024_Cognitive_Architectures_Language_Agents.pdf",
        "title": "Cognitive Architectures for Language Agents",
        "doi": "10.48550/arXiv.2309.02427",
        "urls": [
            "https://arxiv.org/pdf/2309.02427.pdf"
        ]
    },
    {
        "id": 23,
        "filename": "Wexler_2017_Big_Book_of_Dashboards.pdf",
        "title": "The Big Book of Dashboards",
        "urls": []
    },
    {
        "id": 24,
        "filename": "Wickham_2023_R_for_Data_Science.pdf",
        "title": "R for Data Science (2nd ed.)",
        "urls": [
            "https://r4ds.hadley.nz/"
        ]
    },
    {
        "id": 25,
        "filename": "Wilke_2019_Fundamentals_of_Data_Visualization.pdf",
        "title": "Fundamentals of Data Visualization",
        "urls": [
            "https://clauswilke.com/dataviz/"
        ]
    },
    {
        "id": 26,
        "filename": "Xi_2025_Rise_and_Potential_LLM_Based_Agents.pdf",
        "title": "The rise and potential of large language model based agents: a survey",
        "doi": "10.1007/s11432-024-4222-0",
        "urls": [
            "https://arxiv.org/pdf/2309.07864.pdf"
        ]
    },
    {
        "id": 27,
        "filename": "Yao_2023_ReAct_Reasoning_and_Acting_in_LLMs.pdf",
        "title": "ReAct: Synergizing Reasoning and Acting in Language Models",
        "doi": "10.48550/arXiv.2210.03629",
        "urls": [
            "https://arxiv.org/pdf/2210.03629.pdf"
        ]
    },
    {
        "id": 28,
        "filename": "Zhang_2023_Data_Copilot.pdf",
        "title": "Data-Copilot: Bridging Billions of Data and Humans with Autonomous Workflow",
        "doi": "10.48550/arXiv.2306.07209",
        "urls": [
            "https://arxiv.org/pdf/2306.07209.pdf"
        ]
    }
]

def log(msg):
    print(msg, flush=True)

def try_unpaywall(doi):
    try:
        url = f"https://api.unpaywall.org/v2/{doi}?email=research_agent@example.com"
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode())
            best_oa = data.get("best_oa_location")
            if best_oa and best_oa.get("url_for_pdf"):
                return best_oa.get("url_for_pdf")
            if best_oa and best_oa.get("url"):
                return best_oa.get("url")
    except Exception as e:
        log(f"  Unpaywall lookup error for {doi}: {e}")
    return None

def try_semantic_scholar(title):
    try:
        encoded_title = urllib.parse.quote(title)
        url = f"https://api.semanticscholar.org/graph/v1/paper/search?query={encoded_title}&limit=1&fields=openAccessPdf"
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode())
            if data.get("data"):
                pdf_info = data["data"][0].get("openAccessPdf")
                if pdf_info and pdf_info.get("url"):
                    return pdf_info.get("url")
    except Exception as e:
        log(f"  Semantic Scholar lookup error: {e}")
    return None

def download_file(url, target_path):
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, timeout=30) as resp:
        content = resp.read()
        if len(content) < 500:
            return False
        with open(target_path, "wb") as f:
            f.write(content)
        return True

results = []

log("Starting Journal Download Process...")

for item in journals:
    file_path = os.path.join(TARGET_DIR, item["filename"])
    log(f"\nProcessing [{item['id']}/28]: {item['title']}")
    
    if os.path.exists(file_path) and os.path.getsize(file_path) > 2000:
        log(f"  [ALREADY EXISTS] Size: {os.path.getsize(file_path)} bytes")
        results.append({"id": item["id"], "title": item["title"], "status": "Downloaded (Existing)", "file": item["filename"]})
        continue

    success = False
    
    # 1. Try direct URLs
    for url in item.get("urls", []):
        try:
            log(f"  Trying Direct URL: {url}")
            if download_file(url, file_path):
                log(f"  SUCCESS via Direct URL: {url}")
                success = True
                break
        except Exception as e:
            log(f"  Direct URL failed: {e}")
            
    # 2. Try Unpaywall
    if not success and item.get("doi"):
        log(f"  Trying Unpaywall DOI: {item['doi']}")
        oa_url = try_unpaywall(item["doi"])
        if oa_url:
            try:
                log(f"  Trying Unpaywall PDF: {oa_url}")
                if download_file(oa_url, file_path):
                    log(f"  SUCCESS via Unpaywall: {oa_url}")
                    success = True
            except Exception as e:
                log(f"  Unpaywall PDF download failed: {e}")

    # 3. Try Semantic Scholar
    if not success:
        log(f"  Trying Semantic Scholar Search...")
        sem_url = try_semantic_scholar(item["title"])
        if sem_url:
            try:
                log(f"  Trying Semantic Scholar PDF: {sem_url}")
                if download_file(sem_url, file_path):
                    log(f"  SUCCESS via Semantic Scholar: {sem_url}")
                    success = True
            except Exception as e:
                log(f"  Semantic Scholar PDF download failed: {e}")

    if success:
        results.append({"id": item["id"], "title": item["title"], "status": "Downloaded", "file": item["filename"]})
    else:
        results.append({"id": item["id"], "title": item["title"], "status": "Not Open Access / Book", "file": item["filename"]})
        
    time.sleep(0.5)

log("\n=== FINAL RESULTS SUMMARY ===")
success_count = sum(1 for r in results if "Downloaded" in r["status"])
log(f"Downloaded: {success_count} / {len(journals)}")

with open(os.path.join(TARGET_DIR, "results.json"), "w", encoding="utf-8") as f:
    json.dump(results, f, indent=2)

log("Done!")
