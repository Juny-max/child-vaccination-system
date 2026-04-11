from pathlib import Path

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.shared import Inches, Pt


WORKSPACE_DOCS = Path(r"c:\Users\Junior Owusu\Desktop\Final Year Project\child-vaccination-system\docs")
DIAGRAMS_DIR = Path(r"c:\Users\Junior Owusu\Desktop\Final Year Project\diagrams")

CHAPTER1_PATH = WORKSPACE_DOCS / "CHAPTER ONE  (1).docx"
CHAPTER2_PATH = WORKSPACE_DOCS / "CHAPTER 2.docx"
CHAPTER3_PATH = WORKSPACE_DOCS / "CHAPTER-3.docx"
REFERENCES_PATH = WORKSPACE_DOCS / "CHAPTER 5 REFERENCES.docx"


REFERENCES = [
    "World Health Organization, \"Immunization coverage,\" 2025. [Online]. Available: https://www.who.int/news-room/fact-sheets/detail/immunization-coverage. [Accessed: Apr. 10, 2026].",
    "World Health Organization, \"Immunization Agenda 2030: A global strategy to leave no one behind,\" 2020. [Online]. Available: https://www.who.int/initiatives/immunization-agenda-2030. [Accessed: Apr. 10, 2026].",
    "United Nations Children's Fund, \"The State of the World's Children: For every child, vaccination,\" 2023. [Online]. Available: https://www.unicef.org/reports/state-worlds-children. [Accessed: Apr. 10, 2026].",
    "Ghana Health Service, \"Expanded Programme on Immunization operational guidance,\" Accra, Ghana, 2024.",
    "F. D. Davis, \"Perceived usefulness, perceived ease of use, and user acceptance of information technology,\" MIS Quarterly, vol. 13, no. 3, pp. 319-340, 1989.",
    "V. Venkatesh, M. G. Morris, G. B. Davis, and F. D. Davis, \"User acceptance of information technology: Toward a unified view,\" MIS Quarterly, vol. 27, no. 3, pp. 425-478, 2003.",
    "A. Glasgow, T. Vogt, and S. Boles, \"Evaluating the public health impact of health promotion interventions: The RE-AIM framework,\" American Journal of Public Health, vol. 89, no. 9, pp. 1322-1327, 1999.",
    "DHIS2, \"Tracker and Event Program documentation,\" 2025. [Online]. Available: https://docs.dhis2.org. [Accessed: Apr. 10, 2026].",
    "K. Beck et al., \"Manifesto for Agile Software Development,\" 2001. [Online]. Available: https://agilemanifesto.org. [Accessed: Apr. 10, 2026].",
    "K. Schwaber and J. Sutherland, \"The Scrum Guide,\" 2020. [Online]. Available: https://scrumguides.org. [Accessed: Apr. 10, 2026].",
    "Vercel, \"Next.js documentation,\" 2025. [Online]. Available: https://nextjs.org/docs. [Accessed: Apr. 10, 2026].",
    "Meta Open Source, \"React documentation,\" 2025. [Online]. Available: https://react.dev. [Accessed: Apr. 10, 2026].",
    "NestJS Core Team, \"NestJS documentation,\" 2025. [Online]. Available: https://docs.nestjs.com. [Accessed: Apr. 10, 2026].",
    "Supabase Inc., \"Supabase documentation,\" 2025. [Online]. Available: https://supabase.com/docs. [Accessed: Apr. 10, 2026].",
    "PostgreSQL Global Development Group, \"PostgreSQL documentation,\" 2025. [Online]. Available: https://www.postgresql.org/docs. [Accessed: Apr. 10, 2026].",
    "D. Fahlander, \"Dexie.js documentation,\" 2025. [Online]. Available: https://dexie.org/docs. [Accessed: Apr. 10, 2026].",
    "W3C, \"Indexed Database API 3.0,\" 2022. [Online]. Available: https://www.w3.org/TR/IndexedDB. [Accessed: Apr. 10, 2026].",
    "Google, \"Progressive Web Applications,\" 2025. [Online]. Available: https://web.dev/progressive-web-apps. [Accessed: Apr. 10, 2026].",
    "National Institute of Standards and Technology, \"Advanced Encryption Standard (AES),\" FIPS PUB 197, 2001.",
    "M. Jones, J. Bradley, and N. Sakimura, \"Json Web Token (JWT),\" IETF RFC 7519, 2015.",
    "Hubtel, \"Hubtel SMS API documentation,\" 2025. [Online]. Available: https://developers.hubtel.com. [Accessed: Apr. 10, 2026].",
    "Brevo, \"Brevo Transactional Email API documentation,\" 2025. [Online]. Available: https://developers.brevo.com. [Accessed: Apr. 10, 2026].",
    "M. Dhar, \"html5-qrcode,\" 2025. [Online]. Available: https://github.com/mebjas/html5-qrcode. [Accessed: Apr. 10, 2026].",
    "MrRio, \"jsPDF documentation,\" 2025. [Online]. Available: https://github.com/parallax/jsPDF. [Accessed: Apr. 10, 2026].",
    "U. Khan, \"qrcode.react,\" 2025. [Online]. Available: https://github.com/zpao/qrcode.react. [Accessed: Apr. 10, 2026].",
    "V. Agafonkin, \"Leaflet documentation,\" 2025. [Online]. Available: https://leafletjs.com. [Accessed: Apr. 10, 2026].",
    "OpenStreetMap Foundation, \"OpenStreetMap,\" 2025. [Online]. Available: https://www.openstreetmap.org. [Accessed: Apr. 10, 2026].",
    "PostGIS Development Team, \"PostGIS documentation,\" 2025. [Online]. Available: https://postgis.net/documentation. [Accessed: Apr. 10, 2026].",
    "TypeStack, \"class-validator documentation,\" 2025. [Online]. Available: https://github.com/typestack/class-validator. [Accessed: Apr. 10, 2026].",
    "I. Seidman, Interviewing as Qualitative Research: A Guide for Researchers in Education and the Social Sciences, 4th ed. New York, NY, USA: Teachers College Press, 2013.",
]


def configure_document(doc: Document) -> None:
    normal = doc.styles["Normal"]
    normal.font.name = "Times New Roman"
    normal.font.size = Pt(12)

    for section in doc.sections:
        section.top_margin = Inches(1.0)
        section.bottom_margin = Inches(1.0)
        section.left_margin = Inches(1.25)
        section.right_margin = Inches(1.0)


def add_title(doc: Document, chapter: str, subtitle: str) -> None:
    p1 = doc.add_paragraph()
    p1.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r1 = p1.add_run(chapter)
    r1.bold = True
    r1.font.size = Pt(16)

    p2 = doc.add_paragraph()
    p2.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r2 = p2.add_run(subtitle)
    r2.bold = True
    r2.font.size = Pt(14)

    doc.add_paragraph("")


def add_heading(doc: Document, text: str) -> None:
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(12)
    p.paragraph_format.space_after = Pt(4)
    r = p.add_run(text)
    r.bold = True
    r.font.size = Pt(13)


def add_body(doc: Document, text: str) -> None:
    p = doc.add_paragraph(text)
    p.paragraph_format.first_line_indent = Inches(0.3)
    p.paragraph_format.line_spacing = 1.5
    p.paragraph_format.space_after = Pt(6)


def add_list_item(doc: Document, text: str, numbered: bool = False) -> None:
    p = doc.add_paragraph(text)
    p.paragraph_format.left_indent = Inches(0.3)
    p.paragraph_format.line_spacing = 1.5
    p.paragraph_format.space_after = Pt(3)
    if numbered:
        p.style = doc.styles["List Number"]
    else:
        p.style = doc.styles["List Bullet"]


def add_chapter_reference_note(doc: Document) -> None:
    p = doc.add_paragraph(
        "Note: All references cited in this chapter are consolidated in CHAPTER FIVE REFERENCES."
    )
    p.paragraph_format.space_before = Pt(12)
    p.paragraph_format.space_after = Pt(0)
    r = p.runs[0]
    r.italic = True


def add_mermaid_code_block(doc: Document, lines: list[str]) -> None:
    for line in lines:
        p = doc.add_paragraph(line)
        p.paragraph_format.left_indent = Inches(0.4)
        p.paragraph_format.space_after = Pt(0)
        r = p.runs[0]
        r.font.name = "Courier New"
        r.font.size = Pt(10)


def build_chapter_one() -> None:
    doc = Document()
    configure_document(doc)
    add_title(
        doc,
        "CHAPTER ONE",
        "INTRODUCTION AND BACKGROUND TO THE PROJECT",
    )

    add_heading(doc, "1.0 General Introduction")
    add_body(
        doc,
        "Childhood immunization is one of the most effective public health interventions for reducing mortality and preventing severe illness in children [1], [2]. In many low-resource settings, however, the continuity of child vaccination services remains constrained by fragmented records, delayed follow-up, and weak cross-facility visibility. When records are unavailable at the point of care, children risk missed doses, delayed schedules, or unnecessary repeat vaccination.",
    )
    add_body(
        doc,
        "This project delivers a practical digital response through the Child Vaccination Command Center (CVCC), a role-based platform for tracking and managing child vaccination records across multiple healthcare branches. The system supports continuity of care, faster identity verification, timely reminders, and verifiable digital certificates while preserving data privacy and accountability [2], [4].",
    )

    add_heading(doc, "1.1 Background to the Study")
    add_body(
        doc,
        "In Ghana and related healthcare contexts, the Expanded Programme on Immunization relies heavily on paper child welfare records and branch-specific registers [4]. Although these mechanisms are familiar to health workers, they are vulnerable to physical loss, damage, incomplete updates, and delayed reporting. They also make it difficult for a nurse in one facility to view a child history first recorded in another facility.",
    )
    add_body(
        doc,
        "Global digital health guidance encourages modernized immunization systems that strengthen child-level tracking, support follow-up, and improve decision-making at facility and district levels [1], [2]. Therefore, this project explores a multi-branch digital platform that aligns frontline service workflows with managerial and public health oversight.",
    )

    add_heading(doc, "1.2 Problem Statement")
    add_body(
        doc,
        "The project problem is not the absence of immunization software globally. Rather, the practical gap is that many real deployments are either focused on aggregate reporting or are not well aligned with daily frontline workflow. In multi-branch care, this causes fragmented child histories, delayed follow-up, weak appointment visibility, and inconsistent caregiver communication [4], [8].",
    )
    add_body(
        doc,
        "The consequences include missed or overdue doses, duplicate records, manual verification delays, and reduced confidence in proof of vaccination. These weaknesses are amplified when families relocate or seek care from different facilities [1], [2], [4].",
    )

    add_heading(doc, "1.3 Aim of the Project")
    add_body(
        doc,
        "To design and implement a secure digital platform that tracks and manages child vaccination records across multiple healthcare branches while improving continuity of care for caregivers and operational efficiency for health workers.",
    )

    add_heading(doc, "1.4 Specific Objectives")
    add_list_item(
        doc,
        "Digitize child vaccination histories and make them accessible across participating branches through one centralized data layer.",
        numbered=True,
    )
    add_list_item(
        doc,
        "Implement a facility nurse workflow for search, Quick Response (QR) lookup, vaccination recording, and follow-up prioritization.",
        numbered=True,
    )
    add_list_item(
        doc,
        "Implement a Community Health Worker (CHW) outreach workflow with offline registration, offline vaccination capture, and later synchronization.",
        numbered=True,
    )
    add_list_item(
        doc,
        "Provide a caregiver portal for progress tracking, missed-dose monitoring, appointments, and certificate access.",
        numbered=True,
    )
    add_list_item(
        doc,
        "Provide verification readiness through QR-enabled digital certificates and a Public Health Authority (PHA) verification pathway.",
        numbered=True,
    )

    add_heading(doc, "1.5 Research Questions")
    add_list_item(
        doc,
        "What operational barriers do multi-branch facilities face when child vaccination records are fragmented across paper and isolated systems?",
        numbered=True,
    )
    add_list_item(
        doc,
        "How can a role-based digital platform improve child-level tracking, continuity of care, and follow-up outcomes across branches?",
        numbered=True,
    )
    add_list_item(
        doc,
        "How can QR-supported verification reduce lookup time and strengthen confidence in vaccination evidence?",
        numbered=True,
    )
    add_list_item(
        doc,
        "Which design factors most strongly influence adoption by nurses and caregivers in this context?",
        numbered=True,
    )

    add_heading(doc, "1.6 Data Collection Approach and Questionnaire Design")
    add_body(
        doc,
        "The primary data collection approach used a semi-structured questionnaire format implemented through guided interviews with nurses and selected frontline staff. The questionnaire was intentionally semi-structured so that essential questions remained consistent while still allowing respondents to explain practical workflow realities in detail [30].",
    )
    add_body(
        doc,
        "Data collection was completed in two complementary ways. First, team members called nurses by phone and asked the interview questions directly to capture real operational challenges from active practice settings. Second, the team conducted structured online research using policy documents, technical documentation, and related studies to validate observed workflow issues and identify implementation patterns [1], [2], [8].",
    )

    add_heading(doc, "1.7 Scope of the Study")
    add_body(
        doc,
        "The scope covers child vaccination record management, cross-branch retrieval, appointment support, caregiver visibility, and certificate verification workflows. The prototype does not cover adult vaccination, full national rollout governance, or vaccine supply-chain optimization in this phase.",
    )

    add_heading(doc, "1.8 Overview of the Implemented System")
    add_body(
        doc,
        "The implemented CVCC prototype supports seven roles: Parent or Guardian, Facility Nurse, Community Health Worker (CHW), Data Officer, Branch Manager, Headquarters Administrator, and Public Health Authority (PHA). Role separation follows a Role-Based Access Control (RBAC) model and aligns each role with a dedicated interface and operational permissions [13], [20].",
    )
    add_body(
        doc,
        "At architecture level, the system follows a web client to server Application Programming Interface (API) to database model using Next.js, NestJS, and Supabase PostgreSQL [11], [13], [14], [15]. This arrangement supports centralized records with controlled access across branches.",
    )

    add_heading(doc, "1.9 Significance of the Study")
    add_body(
        doc,
        "For health workers, the system reduces lookup and verification time. For caregivers, it improves schedule visibility and proof access. For management teams, it improves branch-level monitoring and supports better intervention planning from more consistent child-level data [2], [4], [8].",
    )

    add_heading(doc, "1.10 Organization of the Study")
    add_list_item(
        doc,
        "Chapter One presents the introduction, project context, problem statement, aims, and scope.",
        numbered=True,
    )
    add_list_item(
        doc,
        "Chapter Two reviews literature, related systems, and adoption theories that support the project design.",
        numbered=True,
    )
    add_list_item(
        doc,
        "Chapter Three presents the methodology, Sprint-based development process, architecture, and system diagrams.",
        numbered=True,
    )

    add_chapter_reference_note(doc)
    doc.save(CHAPTER1_PATH)


def build_chapter_two() -> None:
    doc = Document()
    configure_document(doc)
    add_title(
        doc,
        "CHAPTER TWO",
        "LITERATURE REVIEW AND RELATED WORK",
    )

    add_heading(doc, "2.0 Introduction")
    add_body(
        doc,
        "This chapter reviews established and emerging literature on child vaccination tracking systems, multi-branch record continuity, verification mechanisms, and health technology adoption models. The review positions the Child Vaccination Command Center (CVCC) within current evidence and identifies practical gaps that the prototype addresses.",
    )

    add_heading(doc, "2.1 Immunization Coverage and Monitoring")
    add_body(
        doc,
        "International evidence shows that routine immunization remains uneven across locations, and aggregate national indicators may hide subnational service gaps [1], [2], [3]. This means local facility and outreach visibility are essential for preventing children from becoming overdue or zero-dose.",
    )
    add_body(
        doc,
        "Therefore, modern immunization systems are expected to support both operational service delivery and strategic monitoring so that missed children can be identified early and followed up effectively [1], [2], [3].",
    )

    add_heading(doc, "2.2 Evolution of Vaccination Record Keeping")
    add_body(
        doc,
        "Traditional paper cards and register books remain common in low-resource care settings because they are accessible and inexpensive. However, paper workflows are prone to damage, missing pages, readability issues, and poor cross-facility availability [4].",
    )
    add_body(
        doc,
        "Digital transition has introduced Electronic Immunization Registry (EIR) models and related health information tools. Their impact depends not only on technology but also on workflow fit, infrastructure reliability, and consistent frontline adoption [2], [8].",
    )

    add_heading(doc, "2.3 Categories of Digital Immunization Systems")
    add_list_item(
        doc,
        "Electronic Immunization Registry (EIR) systems: centralized child-level records for monitoring, follow-up, and reporting [2], [8].",
    )
    add_list_item(
        doc,
        "District Health Information Software 2 (DHIS2) Tracker implementations: individual event and longitudinal tracking modules with configurable programs [8].",
    )
    add_list_item(
        doc,
        "Mobile reminder systems: Short Message Service (SMS) and app notifications to improve attendance and dose completion [1], [2].",
    )
    add_list_item(
        doc,
        "Quick Response (QR) and digital certificate systems: fast identity retrieval and verifiable proof workflows [23], [24], [25].",
    )

    add_heading(doc, "2.4 Technology Adoption Foundations")
    add_body(
        doc,
        "The Technology Acceptance Model (TAM) explains adoption through perceived usefulness and perceived ease of use [5]. In immunization settings, this implies that systems must save time and reduce complexity for nurses and support staff.",
    )
    add_body(
        doc,
        "The Unified Theory of Acceptance and Use of Technology (UTAUT) extends this perspective with performance expectancy, effort expectancy, social influence, and facilitating conditions [6]. These dimensions are highly relevant where hardware access, connectivity, and training support vary by branch.",
    )
    add_body(
        doc,
        "The Reach, Effectiveness, Adoption, Implementation, and Maintenance (RE-AIM) framework supports evaluation of scalability and long-term sustainability beyond pilot success [7].",
    )

    add_heading(doc, "2.5 Security, Privacy, and Trust")
    add_body(
        doc,
        "Child health records are sensitive and require controlled access, secure authentication, and traceable actions. Secure system design commonly combines Role-Based Access Control (RBAC), encrypted transport, and controlled token handling such as Json Web Token (JWT) session enforcement [19], [20].",
    )
    add_body(
        doc,
        "Trust in vaccination evidence is strengthened when certificate verification confirms authenticity without unnecessary disclosure of private data [19], [20].",
    )

    add_heading(doc, "2.6 Methods Alignment With This Project")
    add_body(
        doc,
        "As in Chapter Three, the evidence synthesis for this project used a semi-structured questionnaire approach. Interview questions were asked through phone calls with nurses to capture practical clinical and outreach constraints in their own words. This was combined with online research across policy guidance, technical references, and related digital immunization literature [1], [2], [8], [30].",
    )
    add_body(
        doc,
        "The combination of phone interviews and online evidence review improved contextual relevance. It ensured that design choices reflected real workflow conditions rather than generic system assumptions [30].",
    )

    add_heading(doc, "2.7 Research Gap and Positioning of CVCC")
    add_body(
        doc,
        "The literature confirms that digital immunization tools exist, but common implementation gaps remain in integrated frontline usability, caregiver self-service, and cross-branch continuity. Many systems are either reporting-centric or incomplete for routine nurse and Community Health Worker (CHW) operations [1], [2], [8].",
    )
    add_body(
        doc,
        "The CVCC prototype addresses this gap by combining facility workflow support, caregiver tracking, QR-based verification, and offline outreach synchronization in one coordinated platform. It aligns operational and supervisory needs while remaining realistic for incremental deployment.",
    )

    add_heading(doc, "2.8 Chapter Summary")
    add_body(
        doc,
        "Chapter Two establishes the theoretical and practical basis for the project. It confirms the importance of child-level continuity, secure verification, and adoption-aware design. These findings directly inform the methodology and implementation decisions documented in Chapter Three.",
    )

    add_chapter_reference_note(doc)
    doc.save(CHAPTER2_PATH)


def build_chapter_three() -> None:
    doc = Document()
    configure_document(doc)
    add_title(
        doc,
        "CHAPTER THREE",
        "METHODOLOGY AND SYSTEM DESIGN",
    )

    add_heading(doc, "3.0 Introduction")
    add_body(
        doc,
        "This chapter explains how the Child Vaccination Command Center (CVCC) was designed and implemented from requirements discovery through architecture, testing, and documentation. The chapter emphasizes methodological decisions, Sprint execution, and practical constraints from frontline healthcare operations.",
    )

    add_heading(doc, "3.1 Research Methodology and Data Collection")
    add_body(
        doc,
        "The study used a semi-structured questionnaire design implemented through guided interviews with nurses and selected field staff [30]. The semi-structured approach ensured question consistency while allowing respondents to explain branch-specific workflow realities, including follow-up behavior, record transfer difficulties, and verification bottlenecks.",
    )
    add_body(
        doc,
        "Primary collection was performed through direct phone calls to nurses. Secondary evidence was gathered through online research from public health policy documents, platform documentation, and peer-reviewed methods sources [1], [2], [8]. This dual method reduced bias and improved requirement completeness.",
    )
    add_body(
        doc,
        "Key constraints identified from data collection included intermittent connectivity in outreach locations, inconsistent cross-branch child transfer handling, and slow certificate verification workflows. These constraints directly informed the technical architecture and module priorities.",
    )

    add_heading(doc, "3.2 Software Development Methodology With Sprint Model")
    add_body(
        doc,
        "Development followed Agile principles with a Scrum-aligned Sprint process [9], [10]. Work was organized into short iterative cycles, and each Sprint delivered a testable increment of value for one or more user roles.",
    )
    add_list_item(
        doc,
        "Sprint Planning: define user stories, acceptance criteria, and module dependencies.",
    )
    add_list_item(
        doc,
        "Sprint Execution: implement frontend and backend slices with daily synchronization by the team.",
    )
    add_list_item(
        doc,
        "Sprint Review: demonstrate completed functionality against requirements and gather feedback.",
    )
    add_list_item(
        doc,
        "Sprint Retrospective: identify blockers, quality gaps, and process improvements for the next cycle.",
    )
    add_body(
        doc,
        "This Sprint cadence enabled controlled scope evolution and quick correction of defects while preserving shared ownership across team members.",
    )

    add_heading(doc, "3.3 Sprint Workflow Diagram in Mermaid Code")
    add_body(
        doc,
        "The project Sprint cycle is represented below in Mermaid code form so it can be reused directly in documentation tooling or diagram rendering engines.",
    )
    add_mermaid_code_block(
        doc,
        [
            "flowchart LR",
            "    A[Product Backlog - all pending tasks] --> B[Sprint Planning - choose tasks for this cycle]",
            "    B --> C[Sprint Backlog - selected tasks for this Sprint]",
            "    C --> D[Sprint Execution - build and test the selected tasks]",
            "    D --> E[Daily Standup - quick team progress check]",
            "    E --> D",
            "    D --> F[Sprint Review - demonstrate completed work]",
            "    F --> G[Sprint Retrospective - discuss improvements for next Sprint]",
            "    G --> H[Increment Release - deliver working features]",
            "    H --> A",
        ],
    )

    add_heading(doc, "3.4 System Architecture and Technology Stack")
    add_body(
        doc,
        "The platform uses a three-tier model: web client, secure backend Application Programming Interface (API), and centralized relational database [11], [13], [14], [15]. The frontend is implemented with Next.js and React, while backend services are implemented in NestJS with typed request validation [11], [12], [13], [29].",
    )
    add_body(
        doc,
        "Security controls include Role-Based Access Control (RBAC), Json Web Token (JWT) based session enforcement, and controlled data operations over server-side services [13], [20]. In the database layer, access controls and operational logging support accountability across user roles.",
    )
    add_body(
        doc,
        "For outreach resilience, the Community Health Worker (CHW) module uses an offline-first approach with Indexed Database (IndexedDB) storage through Dexie.js and Progressive Web Application (PWA) service-worker caching [16], [17], [18]. Sensitive local data handling aligns with Advanced Encryption Standard (AES) principles [19].",
    )

    add_heading(doc, "3.5 Core Modules Implemented")
    add_list_item(
        doc,
        "Identity and lookup: child search and Quick Response (QR) scanning workflows [23], [25].",
    )
    add_list_item(
        doc,
        "Vaccination capture: facility and outreach record entry with synchronization and conflict handling.",
    )
    add_list_item(
        doc,
        "Certificates: Portable Document Format (PDF) generation and verification flow [24], [25].",
    )
    add_list_item(
        doc,
        "Notifications: Short Message Service (SMS) and email reminders for appointments and due doses [21], [22].",
    )
    add_list_item(
        doc,
        "Monitoring: role-specific dashboards for branch managers and public health supervision.",
    )

    add_heading(doc, "3.6 Testing and Quality Assurance")
    add_body(
        doc,
        "Testing combined functional walkthroughs, endpoint validation, and offline synchronization verification. Integration checks confirmed request validation behavior, role-guard enforcement, and expected data consistency after sync. Offline tests simulated network loss and restoration to verify queue integrity and idempotent replay behavior [16], [17], [29].",
    )
    add_body(
        doc,
        "Defects discovered during implementation were documented and resolved iteratively within Sprint reviews and retrospectives, improving reliability before subsequent module releases.",
    )

    add_heading(doc, "3.7 System Diagrams")
    add_body(
        doc,
        "This section presents all system diagrams supplied for the project. Each diagram is inserted as evidence of system modeling, process flow, and role interaction design.",
    )

    diagram_files = sorted(DIAGRAMS_DIR.glob("*.png"))
    if not diagram_files:
        add_body(doc, "No diagram image was found in the configured diagrams folder at generation time.")
    else:
        for idx, img in enumerate(diagram_files, start=1):
            caption_text = img.stem.replace("-", " ").replace("_", " ").strip().title()
            add_heading(doc, f"3.7.{idx} {caption_text}")
            pic_paragraph = doc.add_paragraph()
            pic_paragraph.alignment = WD_ALIGN_PARAGRAPH.CENTER
            run = pic_paragraph.add_run()
            run.add_picture(str(img), width=Inches(6.0))

    add_heading(doc, "3.8 Chapter Summary")
    add_body(
        doc,
        "Chapter Three documented the project methodology, Sprint-driven development approach, architecture decisions, quality strategy, and system modeling artifacts. The chapter demonstrates that implementation decisions were directly linked to field evidence from semi-structured interviews and online research.",
    )

    add_chapter_reference_note(doc)
    doc.save(CHAPTER3_PATH)


def build_references_doc() -> None:
    doc = Document()
    configure_document(doc)

    add_title(doc, "CHAPTER FIVE", "REFERENCES")
    add_body(
        doc,
        "This chapter consolidates all references cited across Chapter One, Chapter Two, and Chapter Three using Institute of Electrical and Electronics Engineers (IEEE) citation formatting.",
    )

    for index, item in enumerate(REFERENCES, start=1):
        p = doc.add_paragraph()
        p.paragraph_format.left_indent = Inches(0.4)
        p.paragraph_format.first_line_indent = Inches(-0.4)
        p.paragraph_format.space_after = Pt(5)
        p.paragraph_format.line_spacing = 1.3

        num_run = p.add_run(f"[{index}] ")
        num_run.bold = True
        text_run = p.add_run(item)
        text_run.bold = False

    doc.save(REFERENCES_PATH)


def main() -> None:
    build_chapter_one()
    build_chapter_two()
    build_chapter_three()
    build_references_doc()

    print(f"Generated: {CHAPTER1_PATH}")
    print(f"Generated: {CHAPTER2_PATH}")
    print(f"Generated: {CHAPTER3_PATH}")
    print(f"Generated: {REFERENCES_PATH}")


if __name__ == "__main__":
    main()
