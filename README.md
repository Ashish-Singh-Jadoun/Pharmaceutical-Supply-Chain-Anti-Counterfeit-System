2.1.1 Pharmaceutical supply chains and counterfeit medicines
A pharmaceutical supply chain runs from the manufacturer through distributors and wholesalers to pharmacies and, finally, the patient. Records are held separately by each organisation, which makes it difficult to follow a single batch end to end. Traceability, the ability to follow a product through every stage, is therefore central to regulatory compliance, product recalls and the detection of falsified medicines, which can contain too little, too much or none of the intended active ingredient.
2.1.2 Blockchain and smart contracts
A blockchain groups transactions into blocks that are linked by cryptographic hashes, so altering an old record would change every later block and be rejected by the network. Ethereum extends this model with a programmable virtual machine: developers deploy smart contracts whose functions can be called by transactions, whose state is stored on the chain and whose events form a permanent log. These properties, immutability, shared visibility and automatic rule enforcement, are what a supply-chain ledger requires.
2.1.3 Solidity and its tooling
Solidity is the main language for Ethereum smart contracts. OpenZeppelin provides audited, reusable contract components, including access-control patterns that restrict a function to a given role. Hardhat is a development environment for compiling, testing and deploying contracts to a local network or to a public test network. Sepolia is such a test network: contracts deployed there behave as on the main network, but the test currency has no real value.
2.1.4 Web3 front ends
React builds interfaces from reusable components, Vite supplies a fast development server and bundler, and Tailwind CSS provides utility classes for responsive styling. To talk to a blockchain, the interface relies on a wallet such as MetaMask, which holds the user’s keys and asks for approval of every transaction. The Wagmi library provides React hooks for wallet connection and contract calls, built on the Viem client library.
2.1.5 Off-chain services
Storing data on a blockchain is expensive and every entry is public, so applications usually keep only integrity-critical records on the chain and place the rest in a conventional back end. Express is a minimal web framework for Node.js that exposes such a back end as a REST API, and MongoDB, accessed through the Mongoose library, stores the supporting documents.
2.1.6 Consensus, gas and transaction finality
On a public network, nodes agree on the order of transactions through a consensus mechanism, so no single party controls the ledger. Every transaction that changes the state of a contract consumes gas, a fee paid in the network’s currency, and becomes final only after it has been included in a block and confirmed. For a supply-chain application this has two consequences: each recorded step costs a small fee, and the interface must tell the user clearly whether a transaction is pending, confirmed or rejected.
2.1.7 Approaches to medicine traceability
Conventional traceability relies on serialised labels, such as printed codes on packs, and on databases held by each organisation or by a central authority. These systems work as long as every party records honestly and the central database is secure, but a single compromised or careless participant can break the record, and a central database is a single point of failure. Blockchain-based designs spread the record across many nodes and let every participant read the same history, which is why they have attracted interest as a basis for anti-counterfeit systems. The cost is complexity: designers must decide what to store on the chain and how to keep the interface simple.
2.2 Definition of the Practical Problem
The practical problem addressed during the internship was to design and build a system in which: (i) every batch of medicine is registered once, by an authorised manufacturer, in a tamper-proof ledger; (ii) each transfer between manufacturer, distributor, wholesaler and pharmacy is recorded and can be audited; (iii) each participant can perform only the actions that belong to its role; and (iv) a member of the public can check whether a medicine is genuine.
The functional requirements were: registration of participants and assignment of roles; registration of a batch; recording of every transfer and receipt; a public verification page; and a readable history of each batch. The non-functional requirements were a responsive interface, clear feedback for every blockchain transaction, and a code base that can be extended in phases.
2.3 Scope and Evidence
The descriptions in this report are drawn from the team’s design and coding work and from the project’s GitHub repository. The system is a working prototype that runs in a Sepolia test mode.
Chapter 3
MATERIALS AND METHODS
3.1 Project Overview
Pharma-Chain addresses the lack of a single trusted record of a medicine’s journey, which lets counterfeit and substandard products pass unnoticed between manufacturers and pharmacies. A blockchain is valuable here because entries written by authorised parties cannot be altered afterwards and can be verified by anyone, without relying on one central authority. The project ran for 29 days, from 01 August 2026 to 29 August 2026.
3.2 Goals and Scope
The primary objectives of the project were:
•	Traceability: follow every batch from manufacturer to pharmacy.
•	Tamper-proof records: store batch and transfer data on the blockchain.
•	Regulatory compliance: keep an auditable history of who handled a batch and when.
•	Anti-counterfeiting: let any person check the authenticity of a medicine.
The key features delivered were:
•	Smart-contract-driven tracking of batch registration and custody transfer.
•	QR-code integration for quick batch lookup and verification.
•	An audit-log interface that shows the recorded history of a batch.
•	Role-based dashboards for the Admin, Manufacturer, Distributor, Wholesaler, Pharmacy and Public User roles.
3.3 Technical Stack
The project combines a blockchain layer, a web interface and a conventional back end. The components are listed in Table 3.1.
Table 3.1: Technology stack of Pharma-Chain
Layer	Technologies	Purpose
Blockchain	Ethereum (Sepolia test network), Solidity, Hardhat, OpenZeppelin	Smart contracts for batch registration, transfer and verification
Front end	React, Vite, TypeScript, Tailwind CSS	Responsive, role-based user interface
Wallet integration	Wagmi, Viem, MetaMask	Reading contract state and signing transactions
Back end	Node.js, Express, TypeScript	REST API for off-chain functions
Database	MongoDB with Mongoose	Supporting off-chain records
Tools and services	Git and GitHub; [add if used: Docker, GitHub Actions, Postman, cloud hosting]	Version control; [CI/CD, API testing and hosting]

3.4 System Architecture
Pharma-Chain follows a layered organisation (Fig. 3.1). The interface layer, written in React and TypeScript, presents the role-specific screens. The service layer, an Express API, handles requests that do not need the blockchain, and the data layer stores the resulting documents in MongoDB. The blockchain layer holds the Solidity contracts on Sepolia, which are the authoritative record of batches and transfers. The interface reaches the contracts directly through Wagmi, Viem and the user’s MetaMask wallet, so the arrows in the figure show the layering rather than a strict order of calls.
The division of data between the layers follows one rule: whatever must be trusted by every party, such as who registered a batch, who holds it and when it changed hands, is written to the blockchain; whatever is descriptive or changes often, such as user profiles and display details, is kept off-chain in MongoDB. This keeps transaction fees low while preserving the tamper-proof history that the system exists to provide.
Interface layer
(React, TypeScript, Tailwind)	→	Service layer
(Node.js, Express)	→	Data layer
(MongoDB, Mongoose)	→	Blockchain layer
(Solidity, Sepolia)
Figure 3.1: Layered Architecture of Pharma-Chain
3.5 Roles and Workflow
A medicine batch moves through the roles listed in Table 3.2. Each role is permitted to perform only its own steps, so a batch cannot, for example, be registered by a pharmacy or dispensed before it has reached one.
Table 3.2: Roles and responsibilities
Role	Responsibility
Admin	Manages the participants of the system and oversees its operation
Manufacturer	Registers new medicine batches and hands them to a distributor
Distributor	Receives batches from manufacturers and passes them to wholesalers
Wholesaler	Receives batches from distributors and supplies pharmacies
Pharmacy	Receives batches from wholesalers and dispenses them to patients
Public User	Checks the authenticity and history of a medicine

The life of a batch follows a fixed sequence of steps:
•	The Admin authorises each participant and assigns a role.
•	The Manufacturer registers a batch, which creates its record on the blockchain.
•	The Manufacturer transfers the batch to a Distributor, who confirms receipt.
•	The Distributor and the Wholesaler pass the batch along the chain, each transfer being recorded.
•	The Pharmacy receives the batch and makes it available to patients.
•	Any Public User can look up the batch and read its recorded history.
3.6 Smart Contract Design
The smart contracts are the authoritative record of the system. Their behaviour can be summarised as the set of operations in Table 3.3, each of which is restricted to the roles that need it. Access restrictions are built from the access-control components of OpenZeppelin, so that a call from an unauthorised account is rejected by the contract itself and not merely hidden in the interface.
Table 3.3: Main operations of the smart contracts
Operation	Who may call it	Effect
Authorise participant	Admin	Gives an account one of the supply-chain roles
Register batch	Manufacturer	Creates the batch record and emits an event
Transfer custody	Current holder	Records the hand-over to the next participant
Confirm receipt	Receiving participant	Completes the transfer and updates the holder
Verify batch	Anyone	Returns the status and recorded history of a batch

Every state change emits an event. Events are cheap to store, can be read by the interface to build the history of a batch, and provide the raw material for the audit log. The contracts were developed and compiled with Hardhat and are intended for the Sepolia test network.
3.7 Front-End Design
The interface is a single-page application written in React with TypeScript. Routing separates the public pages from the role-specific areas, and a shared layout provides the navigation, header and footer. After the user connects a MetaMask wallet, the screens that the user may see depend on the role recorded for the connected account. TypeScript types describe the data returned by the contracts and by the API, which catches mismatches at compile time. Tailwind CSS supplies the styling; its responsive utilities let the same screens reflow from a phone to a desktop monitor, and the colour and spacing choices are shared so that every screen looks consistent. Each action that writes to the blockchain shows its progress, from waiting for wallet approval to confirmation, so that the user is never left guessing.
3.8 Back-End Design
The back end is a Node.js service written in TypeScript with the Express framework. It exposes a REST API that the interface calls for the data that does not belong on the blockchain, such as participant profiles and descriptive details. Documents are stored in MongoDB through Mongoose models. Keeping this service separate from the contracts means that the heavy or frequently changing data can be edited without any blockchain transaction, while the integrity-critical record remains on the chain.
3.9 My Contributions
We worked as a team of [insert team size, e.g. 4 interns and 2 senior engineers]. The modules, design, testing and documentation work that I carried out are described below.
3.9.1 Modules implemented
•	I set up the front-end project with React, Vite, TypeScript and Tailwind CSS, and built the routing and the shared page layout.
•	I designed and built the landing page and the authentication screens.
•	I built the role-based screens through which each participant interacts with the system.
•	[Add any further modules you personally built, e.g. contract functions, API routes, QR-code verification, the audit-log view.]
3.9.2 Design, testing and documentation
We built the system one phase at a time, in nine phases, so that each phase could be run and checked before the next began; the first phase covered project setup, Tailwind configuration, routing, layout, the landing page and the authentication screens. I took part in design discussions on the roles and screens, tested the screens for each role at phone and desktop widths, and wrote the repository documentation. Source code was committed to GitHub throughout.
3.9.3 Challenges and how they were resolved
•	Different roles needed different actions: we resolved this by giving each role its own screens and permitting only that role’s actions.
•	Wallet and network state affects every transaction: we handled it with Wagmi hooks that show the connection status and the active network to the user.
•	Blockchain writes are slow and can fail: the interface shows the status of each transaction so that the user knows whether it succeeded.
3.10 Testing Method
Each phase was tested before the next was started. Contract behaviour was exercised on a local Hardhat network, the interface was tried with the account of each role, and the browser developer tools were used to check layouts at several screen widths and to trace faults. The test cases are listed in Table 4.3 in Chapter 4.
3.11 Implementation and Output Screens
This section presents the main screens of the working system. The interface carries the product name MedLedger on its screens; Pharma-Chain is the title of the project. Each figure is followed by a short description of what the screen does.
3.11.1 Landing page
The first screen is a split-screen landing and sign-in page. The left panel carries the product name and its tagline, "Trace every medicine. Protect every patient.", a short description of the workspace, and three summary figures: verification scans, on-time delivery and network partners. The right panel holds the sign-in form, so a visitor can enter the system immediately (Fig. 3.2).
 
Figure 3.2: Landing Page of the System
3.11.2 Registration and sign-in screens
The sign-in panel has two tabs, Sign in and Register. The sign-in form asks for an email address and a password, with a Show control for the password, a Remember me option and a Forgot password link. A Demo role list lets the tester choose which role to enter the workspace as, such as Regulator, and a link beneath the button lets a new user create an account. The form is a single column and keeps its proportions on a narrow screen (Fig. 3.3).
 
Figure 3.3: Registration and Sign-in Screen
3.11.3 Admin dashboard
After sign-in, each role sees a role-scoped overview. The screen in Fig. 3.4 is the overview for the Regulator role and is representative of the Admin view. A sidebar gives access to Overview, Batch tracking, QR verification, Cold chain, Recall center and Analytics. The page shows summary cards for active batches, delivered batches, items needing attention and visible records, a chart of verified hand-offs over the last seven days, a cold-chain health gauge, a table of recent batches with their status, location and temperature, and a list of recent ledger events. A panel at the foot of the sidebar shows that the network is running in Sepolia test mode.
 
Figure 3.4: Overview Dashboard (Admin / Regulator Role)
3.11.4 Manufacturer batch registration
The Manufacturer registers a new batch in a pop-up form titled Register a new batch. The form collects the batch ID, product name, manufacturer, quantity, unit, expiry date, current location, safe temperature range and current temperature. The form also states that its fields are saved in the browser only, which marks this version as a demonstration (Fig. 3.5).
 
Figure 3.5: Manufacturer Batch Registration Screen
3.11.5 Transfer and receipt screens
Selecting a batch from the overview opens its batch record (Fig. 3.6). The top of the record gives the product, batch ID and status, followed by the manufacturer, quantity, location, expiry date, temperature against the safe range and the ledger entry reference. Below it, the Verified journey lists every recorded event in order, such as batch manufactured and temperature readings from IoT sensors, each with its place, time and a shortened transaction reference. This list is the audit trail of the batch.
 
Figure 3.6: Batch Receipt and Verified Journey Screen
3.11.6 Public verification and audit log
The verification page is open to a public visitor. The visitor can scan the QR code on the medicine package with the camera scanner or type the batch ID, and the screen then reports Product record verified, with the product, batch, manufacturer, authenticity, safe-handling check and expiry. A Why verify? panel explains the checks, and a note states that public verification shows safety and authenticity results only, while custody details stay restricted to authorised partners (Fig. 3.7). The full audit trail of the batch is the one shown in Fig. 3.6.
 
Figure 3.7: Public Verification and Audit-Log Screen
3.12 Summary of the Implementation
Taken together, the screens above cover the whole life of a medicine batch: admission of participants, registration of a batch, each hand-over along the chain, and verification by the public. The smart contracts hold the authoritative record, the React interface presents it according to the role of the user, and the Express and MongoDB service holds the supporting data. Each part was built and tested in its own phase before being joined to the others, which made faults easier to locate and fix.
The development workflow relied on a small set of habits that are worth recording. Work was committed to GitHub in small, named steps, so that the history of the repository documents how the system grew. Configuration, such as network settings and contract addresses, was kept out of the source files that were committed. Each new screen was checked at phone and desktop widths before the next was started, and each new contract function was exercised from the interface with the account of the role concerned.
Chapter 4
RESULTS AND DISCUSSION
4.1 Outcomes Against Objectives
Table 4.1 relates each objective of the project to the way Pharma-Chain addresses it.
Table 4.1: Objectives and how Pharma-Chain addresses them
Objective	How it is addressed	Status
Traceability	Every batch and every transfer of custody is recorded by the smart contracts	[Confirm status]
Tamper-proof records	Entries are recorded in the ledger and cannot be edited after the fact	[Confirm status]
Role-based access	Six roles, each limited to its own actions	[Confirm status]
Public verification	Any person can check a medicine through the Public User role and QR-code lookup	[Confirm status]
Auditability	An audit-log interface shows the recorded history of a batch	[Confirm status]

4.2 Comparison with Conventional Tracking
Table 4.2 compares Pharma-Chain with the conventional approach of separate databases held by each participant.
Table 4.2: Conventional tracking compared with Pharma-Chain
Aspect	Conventional tracking	Pharma-Chain
Record keeping	Separate databases held by each organisation	One shared ledger visible to every participant
Tamper resistance	Records can be edited by the database owner	Recorded entries cannot be altered afterwards
Verification	Requires access to each party’s system	Open to any person through the verification page
Audit trail	Assembled manually from several sources	Built from the events recorded on the chain
Trust model	Relies on a central authority or on each party	Relies on the network and on the contract rules

4.3 Functional Test Cases
The behaviour of the system was checked against the test cases in Table 4.3, covering the main action of each role.
Table 4.3: Functional test cases
Test case	Expected result	Status
Connect wallet	The account and network are shown; unsupported networks are flagged	[Confirm result]
Authorise participant (Admin)	The account receives the chosen role	[Confirm result]
Register batch (Manufacturer)	A batch record is created and an event is emitted	[Confirm result]
Transfer and receive batch	The holder changes and the hand-over is recorded	[Confirm result]
Unauthorised action	The contract rejects a call from a wrong role	[Confirm result]
Verify batch (Public User)	The status and history of the batch are displayed	[Confirm result]

4.4 Quantified Results
The measured outcomes of the project are summarised below.
•	Time taken to verify a batch: [insert measured value, e.g. seconds per lookup].
•	Transactions processed on Sepolia during testing: [insert number].
•	Contract and interface tests passed: [insert number].
4.5 Feedback and Recognition
Feedback from mentors and stakeholders: [insert feedback]. Notable recognition: [insert, e.g. presented at an internal tech demo].
4.6 Contribution to the Organization’s Objectives
CODTECH IT Solutions runs project-oriented programmes in software and web technologies. Pharma-Chain adds a worked example that joins a modern front end, a back end and a blockchain layer, and it can serve as a reference for later interns who wish to build decentralised applications.
4.7 Discussion
Three points stand out from the work. First, the choice of what to store on the chain matters more than the choice of tools: putting only the integrity-critical records on the blockchain kept the contracts small and the fees low. Second, role-based access had to be enforced in the contract and not only in the interface, because a user can always call a contract directly from outside the web page. Third, the quality of the interface decides whether the ledger is actually used; screens that explain wallet prompts and show transaction progress make a blockchain application usable by people who have never used one.
4.8 Security and Cost Considerations
Security was treated as a design requirement and not as a later addition. Only authorised accounts may change the state of a contract, private keys never leave the user’s wallet, and the interface asks for approval before every transaction. Cost was kept low by storing only essential records on the chain and by reading history from events, which can be queried without paying a fee. Because the system runs on a test network, no real money is spent, but the same design would keep fees modest on a main network or a low-cost Layer-2 network.
Reading data from the blockchain is free of charge and does not need a wallet, which is why the verification page can be offered to the public without an account. Writing data is the only operation that costs a fee, and it is limited to the participants who make changes to the supply chain.
4.9 Limitations
•	The interface works in a demonstration mode: it is labelled "Sepolia test mode, simulated" and saves the entries made in its forms in the browser only, so it is a prototype and not a production system handling real medicines.
•	Data held in MongoDB is not tamper-proof; only the records stored on the blockchain have that property.
•	The smart contracts have not undergone a formal third-party security audit.
•	The temperature and sensor readings shown on the screens are demonstration data; the system does not yet read from physical IoT devices.
4.10 Overall Assessment
Measured against its objectives, the project achieved what a first prototype should: it shows end to end how a medicine batch can be registered, passed along the chain and verified, with a record that no participant can quietly change. The limits listed above are typical of a first version and are mainly matters of scale, privacy and testing, not of the basic design. They define the work that would be needed before the system could be offered to a real pharmaceutical supply chain.

