# Child Vaccination System - Flow Diagrams

This document contains simple flow diagrams for the main modules of the Child Vaccination Command Center system.

---

## ⚠️ IMPORTANT: How to Use These Diagrams

### For Mermaid Live Editor (https://mermaid.live):
1. Copy **ONLY the flowchart code** (starting from `flowchart TD` to the last line before `---`)
2. **DO NOT copy** the ` ```mermaid ` or ` ``` ` markers
3. Paste directly into the Mermaid editor

### For GitHub/Markdown Viewers:
- The diagrams will render automatically in GitHub, VS Code, and other Markdown viewers
- No need to copy anything - just view this file

### For PowerPoint/Word:
1. Copy the flowchart code (without ```mermaid markers)
2. Use Mermaid Live Editor to render it
3. Export as PNG/SVG from the editor
4. Insert the image into your document

---

## 1. Login Module (Unified Login for All Users)

```mermaid
flowchart TD
    Start([User Opens Login Page])
    Start --> EnterCredentials[Enter Email and Password]
    EnterCredentials --> Validate{Valid Email<br/>& Password?}
    
    Validate -->|No| ShowError[Show Error Message]
    ShowError --> EnterCredentials
    
    Validate -->|Yes| SubmitLogin[Submit Login Request<br/>to Backend]
    SubmitLogin --> AuthCheck{Authentication<br/>Successful?}
    
    AuthCheck -->|No| DisplayError[Display Login Failed Error]
    DisplayError --> EnterCredentials
    
    AuthCheck -->|Yes| CheckPassword{Must Change<br/>Password?}
    
    CheckPassword -->|Yes| RedirectChange[Redirect to<br/>Change Password Page]
    RedirectChange --> End1([First-Time Login Complete])
    
    CheckPassword -->|No| SaveUserData[Save User Details to<br/>Local Storage]
    SaveUserData --> CheckRole{Determine<br/>User Role}
    
    CheckRole -->|Parent| ParentDash[Redirect to<br/>Parent Dashboard]
    CheckRole -->|HQ Admin| HQDash[Redirect to<br/>HQ Dashboard]
    CheckRole -->|Branch Manager| BranchDash[Redirect to<br/>Branch Dashboard]
    CheckRole -->|Facility Nurse| FacilityDash[Redirect to<br/>Facility Dashboard]
    CheckRole -->|CHW| CHWDash[Redirect to<br/>CHW Dashboard]
    
    ParentDash --> End2([Login Complete])
    HQDash --> End2
    BranchDash --> End2
    FacilityDash --> End2
    CHWDash --> End2
```

### 📋 Copy-Ready Version (For Mermaid Live Editor)
```
flowchart TD
    Start([User Opens Login Page])
    Start --> EnterCredentials[Enter Email and Password]
    EnterCredentials --> Validate{Valid Email<br/>& Password?}
    
    Validate -->|No| ShowError[Show Error Message]
    ShowError --> EnterCredentials
    
    Validate -->|Yes| SubmitLogin[Submit Login Request<br/>to Backend]
    SubmitLogin --> AuthCheck{Authentication<br/>Successful?}
    
    AuthCheck -->|No| DisplayError[Display Login Failed Error]
    DisplayError --> EnterCredentials
    
    AuthCheck -->|Yes| CheckPassword{Must Change<br/>Password?}
    
    CheckPassword -->|Yes| RedirectChange[Redirect to<br/>Change Password Page]
    RedirectChange --> End1([First-Time Login Complete])
    
    CheckPassword -->|No| SaveUserData[Save User Details to<br/>Local Storage]
    SaveUserData --> CheckRole{Determine<br/>User Role}
    
    CheckRole -->|Parent| ParentDash[Redirect to<br/>Parent Dashboard]
    CheckRole -->|HQ Admin| HQDash[Redirect to<br/>HQ Dashboard]
    CheckRole -->|Branch Manager| BranchDash[Redirect to<br/>Branch Dashboard]
    CheckRole -->|Facility Nurse| FacilityDash[Redirect to<br/>Facility Dashboard]
    CheckRole -->|CHW| CHWDash[Redirect to<br/>CHW Dashboard]
    
    ParentDash --> End2([Login Complete])
    HQDash --> End2
    BranchDash --> End2
    FacilityDash --> End2
    CHWDash --> End2
```

---

## 2. Register Child Module (CHW - Community Health Worker)
**Offline-First Registration for Door-to-Door Field Work**

```mermaid
flowchart TD
    Start([CHW Opens Register Child Page])
    Start --> CheckAuth{User Authenticated<br/>& CHW Role?}
    
    CheckAuth -->|No| RedirectLogin[Redirect to Login Page]
    RedirectLogin --> End1([Access Denied])
    
    CheckAuth -->|Yes| ShowStep1[Display Step 1:<br/>Mother's Information]
    
    ShowStep1 --> EnterMother[Enter Mother's Name<br/>and Phone Number]
    EnterMother --> ValidateMother{Mother Info<br/>Complete?}
    
    ValidateMother -->|No| ShowMotherError[Show Validation Error]
    ShowMotherError --> EnterMother
    
    ValidateMother -->|Yes| ShowStep2[Display Step 2:<br/>Child's Information]
    
    ShowStep2 --> EnterChild[Enter Child's Name,<br/>Date of Birth, Gender]
    EnterChild --> CaptureGPS[Capture GPS Coordinates<br/>using Device Location]
    
    CaptureGPS --> ValidateChild{Child Info<br/>Complete?}
    
    ValidateChild -->|No| ShowChildError[Show Validation Error]
    ShowChildError --> EnterChild
    
    ValidateChild -->|Yes| SaveLocal[Save to Local Storage<br/>IndexedDB]
    SaveLocal --> QueueSync[Add to Sync Queue]
    QueueSync --> ShowSuccess[Display: Saved Locally<br/>Will Sync When Online]
    ShowSuccess --> ResetForm[Reset Form for<br/>Next Registration]
    ResetForm --> End2([Registration Complete - Offline])
    
    QueueSync -.->|Background Process| MonitorNetwork[Monitor Network Status]
    MonitorNetwork --> NetworkAvailable{Network<br/>Available?}
    
    NetworkAvailable -->|No| MonitorNetwork
    
    NetworkAvailable -->|Yes| SyncToServer[Upload to Server<br/>via Backend API]
    SyncToServer --> ServerCheck{Upload<br/>Successful?}
    
    ServerCheck -->|No| RetryLater[Keep in Queue<br/>Retry Later]
    RetryLater -.-> MonitorNetwork
    
    ServerCheck -->|Yes| GenerateID[Server Generates<br/>Child UUID & QR Code]
    GenerateID --> UpdateLocal[Update Local Record<br/>with Server ID]
    UpdateLocal --> SendSMS[Send SMS Reminder<br/>to Mother's Phone]
    SendSMS --> RemoveQueue[Remove from Sync Queue]
    RemoveQueue --> End3([Sync Complete])
```

---

## 3. Record Vaccination Module (Facility Nurse)
**Online with Offline Fallback for Power Cuts & Network Issues**

```mermaid
flowchart TD
    Start([Nurse Opens Child Patient Chart])
    Start --> ViewSchedule[View Vaccination Schedule]
    
    ViewSchedule --> SelectVaccine[Select Vaccine to Give]
    SelectVaccine --> EnterDetails[Fill in Vaccination Details<br/>Batch Number, Date, Site]
    
    EnterDetails --> CheckAEFI{Any Side Effects<br/>Reported?}
    CheckAEFI -->|Yes| MarkAEFI[Mark with Side Effect Flag]
    CheckAEFI -->|No| ValidateForm
    MarkAEFI --> ValidateForm{All Information<br/>Filled?}
    
    ValidateForm -->|No| ShowError[Show Error Message]
    ShowError --> EnterDetails
    
    ValidateForm -->|Yes| TrySave[Try to Save to Database]
    
    TrySave --> SaveSuccess{Saved<br/>Successfully?}
    
    SaveSuccess -->|Yes - Online| ShowSuccess[Show Success Message<br/>Vaccination Recorded]
    ShowSuccess --> UpdateSchedule[Update Child's<br/>Vaccination Schedule]
    UpdateSchedule --> End1([Complete])
    
    SaveSuccess -->|No - Network Error| SaveOffline[Save to Device Storage<br/>For Later Upload]
    SaveOffline --> ShowOfflineMsg[Show Message:<br/>Saved Offline, Will Upload Later]
    ShowOfflineMsg --> End2([Saved Offline])
    
    End2 -.->|When Internet Returns| AutoSync[System Automatically<br/>Uploads Saved Records]
    AutoSync -.-> End1
```

**Note**: When internet connection is restored, the system automatically uploads any offline-saved vaccinations in the background.

---

## 4. Verify Certificate Module (Public - No Login Required)

Accessible from the landing page at `/verify` — anyone can scan or enter a certificate ID.

```mermaid
flowchart TD
    Start([Anyone Opens /verify Page<br/>from Landing Page])
    Start --> ShowOptions[Display Verification Options<br/>No Login Required]
    
    ShowOptions --> ChooseMethod{Select Verification<br/>Method}
    
    ChooseMethod -->|Manual Entry| EnterID[Enter Certificate ID<br/>Manually]
    ChooseMethod -->|QR Scan| OpenScanner[Open QR Code Scanner<br/>on Device Camera]
    
    OpenScanner --> ScanQR[Scan Certificate<br/>QR Code]
    ScanQR --> QRSuccess{QR Code<br/>Detected?}
    
    QRSuccess -->|No| ScanError[Show Scan Error]
    ScanError --> OpenScanner
    
    QRSuccess -->|Yes| ExtractID[Extract Certificate ID<br/>from QR Payload]
    ExtractID --> VerifyData
    
    EnterID --> CheckID{Certificate ID<br/>Entered?}
    CheckID -->|No| ShowIDError[Show Error:<br/>ID Required]
    ShowIDError --> EnterID
    
    CheckID -->|Yes| VerifyData[Send Request to<br/>Next.js Route Handler]
    
    VerifyData --> QueryDB[Query Supabase Database<br/>Directly - No Auth Needed]
    QueryDB --> RecordExists{Certificate<br/>Exists?}
    
    RecordExists -->|No| ShowNotFound[Display:<br/>CERTIFICATE NOT FOUND]
    ShowNotFound --> End2([Verification Complete])
    
    RecordExists -->|Yes| CheckStatus{Certificate<br/>Status?}
    
    CheckStatus -->|Revoked| ShowRevoked[Display:<br/>CERTIFICATE REVOKED]
    ShowRevoked --> End2
    
    CheckStatus -->|Pending - Incomplete Vaccines| ShowPending[Display:<br/>VACCINATION INCOMPLETE<br/>Show completed vs remaining]
    ShowPending --> End2
    
    CheckStatus -->|Valid & Complete| ShowValid[Display:<br/>VALID CERTIFICATE]
    ShowValid --> DisplayDetails[Show Child Name, DOB,<br/>Vaccines Completed, Issue Date]
    DisplayDetails --> End3([Verification Complete])
```

---

## 5. Change Password Module (First-Time Login)

```mermaid
flowchart TD
    Start([User Redirected to<br/>Change Password Page])
    Start --> ShowForm[Display Change<br/>Password Form]
    
    ShowForm --> EnterOld[Enter Current<br/>Temporary Password]
    EnterOld --> EnterNew[Enter New Password]
    EnterNew --> EnterConfirm[Confirm New Password]
    
    EnterConfirm --> ValidateInput{Validate Input}
    
    ValidateInput -->|Empty Fields| ShowError1[Show Error:<br/>All Fields Required]
    ShowError1 --> EnterOld
    
    ValidateInput -->|Password Too Short| ShowError2[Show Error:<br/>Minimum 6 Characters]
    ShowError2 --> EnterNew
    
    ValidateInput -->|Passwords Don't Match| ShowError3[Show Error:<br/>Passwords Must Match]
    ShowError3 --> EnterNew
    
    ValidateInput -->|Valid| SubmitChange[Submit Password<br/>Change Request]
    
    SubmitChange --> VerifyOld{Current Password<br/>Correct?}
    
    VerifyOld -->|No| ShowError4[Show Error:<br/>Incorrect Current Password]
    ShowError4 --> EnterOld
    
    VerifyOld -->|Yes| UpdateDB[Update Password<br/>in Database]
    UpdateDB --> ClearFlag[Clear Must Change<br/>Password Flag]
    ClearFlag --> ShowSuccess[Display Success Message]
    ShowSuccess --> RedirectDash[Redirect to<br/>User's Dashboard]
    RedirectDash --> End([Password Changed Successfully])
```

---

## 6. Parent Dashboard - View Child Records

```mermaid
flowchart TD
    Start([Parent Logs into Dashboard])
    Start --> CheckAuth{Authenticated<br/>as Parent?}
    
    CheckAuth -->|No| RedirectLogin[Redirect to Login]
    RedirectLogin --> End1([Access Denied])
    
    CheckAuth -->|Yes| FetchChildren[Fetch Parent's<br/>Children List from DB]
    
    FetchChildren --> HasChildren{Has Registered<br/>Children?}
    
    HasChildren -->|No| ShowEmpty[Display Empty State<br/>No Children Registered]
    ShowEmpty --> End2([Dashboard Loaded])
    
    HasChildren -->|Yes| DisplayList[Display List of<br/>Children with Photos]
    DisplayList --> SelectChild{Parent Selects<br/>a Child?}
    
    SelectChild -->|No| End2
    
    SelectChild -->|Yes| LoadDetails[Load Child's Full Details]
    LoadDetails --> FetchVaccinations[Fetch Vaccination Records]
    FetchVaccinations --> DisplayRecords[Display Vaccination<br/>Schedule & Status]
    DisplayRecords --> ShowActions[Show Available Actions]
    
    ShowActions --> ChooseAction{Parent Chooses<br/>Action}
    
    ChooseAction -->|View Certificate| GenerateCert[Generate Digital Certificate<br/>with QR Code]
    GenerateCert --> ShowCert[Display Certificate]
    ShowCert --> End3([Action Complete])
    
    ChooseAction -->|Download PDF| CreatePDF[Generate PDF Certificate]
    CreatePDF --> DownloadPDF[Download PDF to Device]
    DownloadPDF --> End3
    
    ChooseAction -->|View Next Due| ShowNextDue[Display Next Due<br/>Vaccination & Date]
    ShowNextDue --> End3
    
    ChooseAction -->|Back to List| DisplayList
```

---

## 7. Generate Reports Module (Branch Manager / HQ Admin)

```mermaid
flowchart TD
    Start([User Opens Reports Page])
    Start --> CheckAuth{Authenticated<br/>& Authorized?}
    
    CheckAuth -->|No| RedirectLogin[Redirect to Login]
    RedirectLogin --> End1([Access Denied])
    
    CheckAuth -->|Yes| ShowReportTypes[Display Report Types]
    
    ShowReportTypes --> SelectType{Select Report Type}
    
    SelectType -->|Coverage Report| SetCoverage[Select Date Range<br/>and Region]
    SelectType -->|Stock Report| SetStock[Select Facility<br/>and Date Range]
    SelectType -->|Defaulter Report| SetDefaulter[Select Date Range<br/>and Vaccine Type]
    SelectType -->|Custom Report| SetCustom[Select Custom<br/>Filters & Criteria]
    
    SetCoverage --> ValidateFilters
    SetStock --> ValidateFilters
    SetDefaulter --> ValidateFilters
    SetCustom --> ValidateFilters
    
    ValidateFilters{Filters<br/>Valid?}
    
    ValidateFilters -->|No| ShowFilterError[Show Error:<br/>Invalid Filter Selection]
    ShowFilterError --> ShowReportTypes
    
    ValidateFilters -->|Yes| GenerateReport[Generate Report<br/>from Database]
    
    GenerateReport --> ProcessData[Process & Aggregate Data]
    ProcessData --> CreateVisuals[Create Charts & Tables]
    CreateVisuals --> DisplayReport[Display Report on Screen]
    
    DisplayReport --> ExportOption{Export Report?}
    
    ExportOption -->|No| End2([Report Viewed])
    
    ExportOption -->|PDF| GeneratePDF[Generate PDF Report]
    GeneratePDF --> DownloadPDF[Download PDF]
    DownloadPDF --> End2
    
    ExportOption -->|Excel| GenerateExcel[Generate Excel Report]
    GenerateExcel --> DownloadExcel[Download Excel File]
    DownloadExcel --> End2
    
    ExportOption -->|CSV| GenerateCSV[Generate CSV File]
    GenerateCSV --> DownloadCSV[Download CSV]
    DownloadCSV --> End2
```

---

## 8. SMS Reminder System

```mermaid
flowchart TD
    Start([System Scheduler Runs Daily])
    Start --> CheckTime{Current Time<br/>= 8:00 AM?}
    
    CheckTime -->|No| Wait[Wait]
    Wait --> Start
    
    CheckTime -->|Yes| FetchDue[Fetch Children with<br/>Due Vaccinations]
    
    FetchDue --> HasDue{Any Due<br/>Vaccinations?}
    
    HasDue -->|No| LogNoReminders[Log: No Reminders Today]
    LogNoReminders --> End1([Scheduler Complete])
    
    HasDue -->|Yes| ProcessList[Process Each Child<br/>in Due List]
    
    ProcessList --> GetGuardian[Get Guardian Phone Number]
    GetGuardian --> CheckPhone{Valid Phone<br/>Number?}
    
    CheckPhone -->|No| SkipChild[Skip this Child<br/>Log Error]
    SkipChild --> MoreChildren
    
    CheckPhone -->|Yes| CreateMessage[Create SMS Message<br/>with Child Name, Vaccine, Due Date]
    CreateMessage --> SendSMS[Send SMS via<br/>Twilio API]
    
    SendSMS --> SMSStatus{SMS Sent<br/>Successfully?}
    
    SMSStatus -->|No| LogFailure[Log SMS Failure]
    LogFailure --> MoreChildren
    
    SMSStatus -->|Yes| UpdateRecord[Update Reminder<br/>Sent Status]
    UpdateRecord --> LogSuccess[Log SMS Success]
    LogSuccess --> MoreChildren
    
    MoreChildren{More Children<br/>in List?}
    
    MoreChildren -->|Yes| ProcessList
    MoreChildren -->|No| GenerateSummary[Generate Daily<br/>Summary Report]
    GenerateSummary --> End2([Reminder Process Complete])
```

---

## 9. Offline Sync Module

```mermaid
flowchart TD
    Start([User Performs Action<br/>on Mobile Device])
    Start --> CheckOnline{Device<br/>Online?}
    
    CheckOnline -->|Yes| SaveDirect[Save Data Directly<br/>to Online Database]
    SaveDirect --> Success[Display Success Message]
    Success --> End1([Action Complete])
    
    CheckOnline -->|No| SaveLocal[Save to Local Storage<br/>IndexedDB]
    SaveLocal --> QueueSync[Add to Sync Queue]
    QueueSync --> ShowOffline[Display: Saved<br/>Will Sync When Online]
    ShowOffline --> Wait[Wait for Connection]
    
    Wait --> Monitor[Monitor Network Status]
    Monitor --> NetworkCheck{Network<br/>Detected?}
    
    NetworkCheck -->|No| Wait
    
    NetworkCheck -->|Yes| CheckQueue{Pending Items<br/>in Queue?}
    
    CheckQueue -->|No| End2([Sync Complete])
    
    CheckQueue -->|Yes| GetNextItem[Get Next Item<br/>from Queue]
    GetNextItem --> ValidateData{Data Still<br/>Valid?}
    
    ValidateData -->|No| RemoveItem[Remove from Queue<br/>Log Error]
    RemoveItem --> CheckQueue
    
    ValidateData -->|Yes| SyncToServer[Upload Data<br/>to Server]
    
    SyncToServer --> ServerCheck{Upload<br/>Successful?}
    
    ServerCheck -->|No| CheckRetry{Max Retries<br/>Reached?}
    CheckRetry -->|No| RetryLater[Keep in Queue<br/>Retry Later]
    RetryLater --> CheckQueue
    
    CheckRetry -->|Yes| MarkFailed[Mark as Failed<br/>Notify User]
    MarkFailed --> CheckQueue
    
    ServerCheck -->|Yes| RemoveFromQueue[Remove from Queue]
    RemoveFromQueue --> UpdateLocal[Update Local Record<br/>with Server ID]
    UpdateLocal --> CheckQueue
```

---

## 10. Search Child Module

```mermaid
flowchart TD
    Start([User Opens Search<br/>Child Page])
    Start --> ShowSearch[Display Search Form]
    
    ShowSearch --> EnterCriteria[Enter Search Criteria]
    
    EnterCriteria --> SelectMethod{Select Search<br/>Method}
    
    SelectMethod -->|By ID| EnterID[Enter Child ID/UUID]
    SelectMethod -->|By Name| EnterName[Enter Child Name]
    SelectMethod -->|By Guardian| EnterGuardian[Enter Guardian Phone/Name]
    SelectMethod -->|QR Scan| ScanQR[Scan Child's QR Code]
    
    EnterID --> Validate
    EnterName --> Validate
    EnterGuardian --> Validate
    ScanQR --> ExtractID[Extract Child ID<br/>from QR Code]
    ExtractID --> Validate
    
    Validate{Search Input<br/>Valid?}
    
    Validate -->|No| ShowError[Show Validation Error]
    ShowError --> EnterCriteria
    
    Validate -->|Yes| QueryDB[Query Database<br/>with Search Criteria]
    
    QueryDB --> ResultCheck{Results<br/>Found?}
    
    ResultCheck -->|No| ShowNoResults[Display: No Children Found]
    ShowNoResults --> TryAgain{Try Different<br/>Search?}
    TryAgain -->|Yes| EnterCriteria
    TryAgain -->|No| End1([Search Ended])
    
    ResultCheck -->|Single Match| LoadDetails[Load Child's Full Details]
    LoadDetails --> DisplayFull[Display Complete Record<br/>& Vaccination History]
    DisplayFull --> ShowActions
    
    ResultCheck -->|Multiple Matches| DisplayList[Display List of<br/>Matching Children]
    DisplayList --> SelectOne{User Selects<br/>One Child?}
    SelectOne -->|No| End1
    SelectOne -->|Yes| LoadDetails
    
    ShowActions[Show Available Actions]
    ShowActions --> ChooseAction{Choose Action}
    
    ChooseAction -->|View Only| End2([View Complete])
    
    ChooseAction -->|Record Vaccination| RedirectRecord[Go to Record<br/>Vaccination Page]
    RedirectRecord --> End2
    
    ChooseAction -->|Edit Details| EditForm[Open Edit Form]
    EditForm --> SaveChanges[Save Changes<br/>to Database]
    SaveChanges --> End2
    
    ChooseAction -->|View Certificate| ShowCert[Display Digital<br/>Certificate]
    ShowCert --> End2
```

---

## Notes for Presentation

### How to Use These Diagrams:

1. **Login Module**: Shows how all users (parents and staff) log in and get redirected to their specific dashboards
2. **Register Child Module (CHW)**: Demonstrates the offline-first registration process for door-to-door field work - saves locally first, then syncs to server when network is available
3. **Record Vaccination Module (Facility Nurse)**: Shows the online-with-offline-fallback design for recording vaccinations at facilities - handles power cuts and network interruptions gracefully
4. **Verify Certificate Module (Public)**: Shows how anyone can verify a certificate from the landing page using QR scan or manual entry — no login required
5. **Change Password Module**: Explains the first-time login password change flow
6. **Parent Dashboard**: How parents view their children's vaccination records
7. **Generate Reports**: How Branch Managers and HQ Admins generate various reports
8. **SMS Reminder System**: Automated daily process for sending vaccination reminders
9. **Offline Sync Module**: How the system handles offline mode and synchronizes data
10. **Search Child Module**: How staff search for children using different methods

### Key Features Highlighted:
- ✅ **Offline capability** with local storage and sync
- ✅ **Role-based access** control (different dashboards for different users)
- ✅ **QR code** functionality for verification and searching
- ✅ **GPS tracking** for community health worker registrations
- ✅ **SMS reminders** for vaccination due dates
- ✅ **Multi-method search** (ID, name, guardian, QR code)
- ✅ **Certificate verification** — public page, no login required
- ✅ **Report generation** with multiple export formats

### Important Implementation Details:
- **CHW Registration (Module 2)**: ✅ **Implemented** - Offline-first field work. Always saves to local storage immediately, then syncs to server in background when network becomes available. Perfect for rural/remote areas.
- **Record Vaccination (Module 3)**: 🔄 **To Be Implemented** - Online-with-offline-fallback design. Tries API first, if network fails saves to IndexedDB and syncs later. Critical for handling power cuts and network interruptions at facilities.
- **Offline Sync (Module 9)**: Generic background sync process. Currently used by CHW registration, will also be used by vaccination recording once offline fallback is implemented.

### Implementation Guide for Offline Vaccination Recording:
1. **Try to save online first** - Always attempt to save to database when internet is available
2. **If network fails** - Save vaccination details to device storage (local database)
3. **Show clear message** - Tell nurse if saved online or saved offline
4. **Auto-upload later** - When internet comes back, system automatically uploads saved records
5. **Simple user experience** - Nurse doesn't need to do anything special, system handles it automatically

These diagrams are based on the actual implementation in your codebase and reflect real workflows.
