// Generated from shared-schema. Do not edit by hand.
// Source: docs/api.md, API version 1.
// Regenerate with: pnpm generate (swift)

import Foundation

public enum API {
    // This file was generated from JSON Schema using quicktype, do not modify it directly.
    // To parse the JSON, add this file to your project and do:
    //
    //   let contract = try? JSONDecoder().decode(Contract.self, from: jsonData)


    // MARK: - Contract
    public struct Contract: Codable, Sendable {
        public let activityEvent: ActivityEvent?
        public let activityLine: ActivityLine?
        public let activityPage: ActivityPage?
        public let actor: Actor?
        public let addressLink: AddressLink?
        public let addressLinkAccount: AddressLinkAccount?
        public let addressLinkKind: AddressLinkKind?
        public let agentFacePick: AgentFacePick?
        public let agentInRoom: AgentInRoom?
        public let agentInRoomList: AgentInRoomList?
        public let agentList: AgentList?
        public let agentMade: AgentMade?
        public let agentReachChanged: AgentReachChanged?
        public let agentRow: AgentRow?
        public let agentStatus: AgentStatus?
        public let agentStatusList: AgentStatusList?
        public let agentStatusSet: AgentStatusSet?
        public let agentTokenMade: AgentTokenMade?
        public let agentWork: AgentWork?
        public let agentWorkTask: AgentWorkTask?
        public let agentWorkTasks: AgentWorkTasks?
        public let apiError: APIError?
        public let apiToken: APIToken?
        public let atNumber: AtNumber?
        public let audienceChanged: AudienceChanged?
        public let auditEvent: AuditEvent?
        public let auditPage: AuditPage?
        public let auditPeople: AuditPeople?
        public let blockerAdded: BlockerAdded?
        public let brand: Brand?
        public let comment: Comment?
        public let commentOnObject: CommentOnObject?
        public let commentsPage: CommentsPage?
        public let conversation: Conversation?
        public let conversationInList: ConversationInList?
        public let conversationList: ConversationList?
        public let count: Count?
        public let countOrNone: CountOrNone?
        public let created: Created?
        public let cycleInProject: CycleInProject?
        public let cyclesInProject: CyclesInProject?
        public let deletedFile: DeletedFile?
        public let deletedFilesPage: DeletedFilesPage?
        public let deletionPlan: DeletionPlan?
        public let directMade: DirectMade?
        public let docVersion: DocVersion?
        public let docVersionPage: DocVersionPage?
        public let docVersionRead: DocVersionRead?
        public let docVersionRestored: DocVersionRestored?
        public let feedbackPublic: FeedbackPublic?
        public let feedbackSettings: FeedbackSettings?
        public let file: File?
        public let fileChanged: FileChanged?
        public let fileImported: FileImported?
        public let fileInDetail: FileInDetail?
        public let fileInList: FileInList?
        public let fileLink: FileLink?
        public let fileRead: FileRead?
        public let filesInProject: FilesInProject?
        public let forAgentsChanged: ForAgentsChanged?
        public let gifKey: GIFKey?
        public let githubHello: GithubHello?
        public let githubLink: GithubLink?
        public let githubRepo: GithubRepo?
        public let githubRepos: GithubRepos?
        public let hoursByPerson: HoursByPerson?
        public let hoursList: HoursList?
        public let importProgress: ImportProgress?
        public let importTeam: ImportTeam?
        public let importTeams: ImportTeams?
        public let inbox: Inbox?
        public let inboxCodeSent: InboxCodeSent?
        public let inboxSettings: InboxSettings?
        public let instance: Instance?
        public let instanceLetter: InstanceLetter?
        public let instanceOwner: InstanceOwner?
        public let invite: Invite?
        public let inviteForMe: InviteForMe?
        public let inviteList: InviteList?
        public let inviteMade: InviteMade?
        public let invitePreview: InvitePreview?
        public let inviteRow: InviteRow?
        public let labelInProject: LabelInProject?
        public let labelOnTask: LabelOnTask?
        public let labelsInProject: LabelsInProject?
        public let leftWorkspace: LeftWorkspace?
        public let linkBack: LinkBack?
        public let linkPreview: LinkPreview?
        public let linksBack: LinksBack?
        public let listInProject: ListInProject?
        public let listPage: ListPage?
        public let listsInProject: ListsInProject?
        public let mailSetup: MailSetup?
        public let me: Me?
        public let meActor: MeActor?
        public let meEmail: MeEmail?
        public let membership: Membership?
        public let message: Message?
        public let messageInRoom: MessageInRoom?
        public let messagePage: MessagePage?
        public let messagesImported: MessagesImported?
        public let meWorkspace: MeWorkspace?
        public let myTask: MyTask?
        public let myTaskList: MyTaskList?
        public let nameable: Nameable?
        public let nameables: Nameables?
        public let notification: Notification?
        public let notificationInInbox: NotificationInInbox?
        public let nowhereMe: NowhereMe?
        public let nowhereSession: NowhereSession?
        public let objectLink: ObjectLink?
        public let openOnPerson: OpenOnPerson?
        public let passwordChanged: PasswordChanged?
        public let passwordSet: PasswordSet?
        public let pending: PendingClass?
        public let peopleList: PeopleList?
        public let personDay: PersonDay?
        public let personHours: PersonHours?
        public let personInProject: PersonInProject?
        public let personInWorkspace: PersonInWorkspace?
        public let personOnPage: PersonOnPage?
        public let personPage: PersonPage?
        public let personWeek: PersonWeek?
        public let post: Post?
        public let postInList: PostInList?
        public let postInProject: PostInProject?
        public let postPage: PostPage?
        public let postPublished: PostPublished?
        public let postRead: PostRead?
        public let project: ProjectClass?
        public let projectBin: ProjectBin?
        public let projectGithub: ProjectGithub?
        public let projectInBin: ProjectInBin?
        public let projectInList: ProjectInList?
        public let projectMember: ProjectMember?
        public let projectMembers: ProjectMembers?
        public let projectPage: ProjectPage?
        public let projectSlack: ProjectSlack?
        public let providers: Providers?
        public let publicDocument: PublicDocument?
        public let publicShare: PublicShare?
        public let pullOnTask: PullOnTask?
        public let pushDevice: PushDevice?
        public let pushDevices: PushDevices?
        public let pushTried: PushTried?
        public let pushTriedDevice: PushTriedDevice?
        public let questionAnswer: QuestionAnswer?
        public let questionChoice: QuestionChoice?
        public let questionInInbox: QuestionInInbox?
        public let realtimeEvent: RealtimeEvent?
        public let recoveryCodes: RecoveryCodes?
        public let removedFrom: RemovedFrom?
        public let contractRepeat: Repeat?
        public let rewait: Rewait?
        public let roomHook: RoomHook?
        public let roomHookAddress: RoomHookAddress?
        public let roomHooks: RoomHooks?
        public let roomPeople: RoomPeople?
        public let roomPerson: RoomPerson?
        public let savedTemplate: SavedTemplate?
        public let savedTemplates: SavedTemplates?
        public let searchResult: SearchResult?
        public let searchResults: SearchResults?
        public let serverRelease: ServerRelease?
        public let serverUpdate: ServerUpdate?
        public let serverVersion: ServerVersion?
        public let session: SessionClass?
        public let sessionRow: SessionRow?
        public let sessions: Sessions?
        public let setupMail: SetupMail?
        public let setupState: SetupState?
        public let sharedProject: SharedProject?
        public let signInCodeAsked: SignInCodeAsked?
        public let slackChannel: SlackChannel?
        public let slackChannels: SlackChannels?
        public let slackHello: SlackHello?
        public let slackLink: SlackLink?
        public let spendList: SpendList?
        public let spendOnTask: SpendOnTask?
        public let step: Step?
        public let stepChanged: StepChanged?
        public let stepMade: StepMade?
        public let subscription: Subscription?
        public let task: Task?
        public let taskCard: TaskCard?
        public let taskCardFace: TaskCardFace?
        public let taskChanged: TaskChanged?
        public let taskCopied: TaskCopied?
        public let taskDeleted: TaskDeleted?
        public let taskDuplicated: TaskDuplicated?
        public let taskInDetail: TaskInDetail?
        public let taskInList: TaskInList?
        public let taskInProject: TaskInProject?
        public let taskList: TaskList?
        public let taskPage: TaskPage?
        public let taskPicture: TaskPicture?
        public let taskPrompt: TaskPrompt?
        public let taskRead: TaskRead?
        public let taskRelated: TaskRelated?
        public let taskReminder: TaskReminder?
        public let taskReminderSet: TaskReminderSet?
        public let tasksImported: TasksImported?
        public let templateChanged: TemplateChanged?
        public let timeOnObject: TimeOnObject?
        public let tokenMade: TokenMade?
        public let tokenRow: TokenRow?
        public let tokens: Tokens?
        public let twoFactor: TwoFactor?
        public let twoFactorBegun: TwoFactorBegun?
        public let unconfirmedAnswered: UnconfirmedAnswered?
        public let unconfirmedWorkspaces: UnconfirmedWorkspaces?
        public let user: User?
        public let verified: Verified?
        public let versionContributor: VersionContributor?
        public let waitingInvitations: WaitingInvitations?
        public let wayIn: WayIn?
        public let wayInAdded: WayInAdded?
        public let wayInStart: WayInStart?
        public let waysIn: WaysIn?
        public let webhookChanged: WebhookChanged?
        public let webhookMade: WebhookMade?
        public let webhookRow: WebhookRow?
        public let webhooks: Webhooks?
        public let workspace: WorkspaceClass?
        public let workspaceAddress: WorkspaceAddress?
        public let workspaceErasing: WorkspaceErasing?
        public let workspaceImport: WorkspaceImport?
        public let workspaceImports: WorkspaceImports?
        public let workspaceInList: WorkspaceInList?
        public let workspaceList: WorkspaceList?
        public let workspaceMade: WorkspaceMade?
        public let workspaceSettings: WorkspaceSettings?

        public enum CodingKeys: String, CodingKey {
            case activityEvent = "ActivityEvent"
            case activityLine = "ActivityLine"
            case activityPage = "ActivityPage"
            case actor = "Actor"
            case addressLink = "AddressLink"
            case addressLinkAccount = "AddressLinkAccount"
            case addressLinkKind = "AddressLinkKind"
            case agentFacePick = "AgentFacePick"
            case agentInRoom = "AgentInRoom"
            case agentInRoomList = "AgentInRoomList"
            case agentList = "AgentList"
            case agentMade = "AgentMade"
            case agentReachChanged = "AgentReachChanged"
            case agentRow = "AgentRow"
            case agentStatus = "AgentStatus"
            case agentStatusList = "AgentStatusList"
            case agentStatusSet = "AgentStatusSet"
            case agentTokenMade = "AgentTokenMade"
            case agentWork = "AgentWork"
            case agentWorkTask = "AgentWorkTask"
            case agentWorkTasks = "AgentWorkTasks"
            case apiError = "ApiError"
            case apiToken = "ApiToken"
            case atNumber = "AtNumber"
            case audienceChanged = "AudienceChanged"
            case auditEvent = "AuditEvent"
            case auditPage = "AuditPage"
            case auditPeople = "AuditPeople"
            case blockerAdded = "BlockerAdded"
            case brand = "Brand"
            case comment = "Comment"
            case commentOnObject = "CommentOnObject"
            case commentsPage = "CommentsPage"
            case conversation = "Conversation"
            case conversationInList = "ConversationInList"
            case conversationList = "ConversationList"
            case count = "Count"
            case countOrNone = "CountOrNone"
            case created = "Created"
            case cycleInProject = "CycleInProject"
            case cyclesInProject = "CyclesInProject"
            case deletedFile = "DeletedFile"
            case deletedFilesPage = "DeletedFilesPage"
            case deletionPlan = "DeletionPlan"
            case directMade = "DirectMade"
            case docVersion = "DocVersion"
            case docVersionPage = "DocVersionPage"
            case docVersionRead = "DocVersionRead"
            case docVersionRestored = "DocVersionRestored"
            case feedbackPublic = "FeedbackPublic"
            case feedbackSettings = "FeedbackSettings"
            case file = "File"
            case fileChanged = "FileChanged"
            case fileImported = "FileImported"
            case fileInDetail = "FileInDetail"
            case fileInList = "FileInList"
            case fileLink = "FileLink"
            case fileRead = "FileRead"
            case filesInProject = "FilesInProject"
            case forAgentsChanged = "ForAgentsChanged"
            case gifKey = "GifKey"
            case githubHello = "GithubHello"
            case githubLink = "GithubLink"
            case githubRepo = "GithubRepo"
            case githubRepos = "GithubRepos"
            case hoursByPerson = "HoursByPerson"
            case hoursList = "HoursList"
            case importProgress = "ImportProgress"
            case importTeam = "ImportTeam"
            case importTeams = "ImportTeams"
            case inbox = "Inbox"
            case inboxCodeSent = "InboxCodeSent"
            case inboxSettings = "InboxSettings"
            case instance = "Instance"
            case instanceLetter = "InstanceLetter"
            case instanceOwner = "InstanceOwner"
            case invite = "Invite"
            case inviteForMe = "InviteForMe"
            case inviteList = "InviteList"
            case inviteMade = "InviteMade"
            case invitePreview = "InvitePreview"
            case inviteRow = "InviteRow"
            case labelInProject = "LabelInProject"
            case labelOnTask = "LabelOnTask"
            case labelsInProject = "LabelsInProject"
            case leftWorkspace = "LeftWorkspace"
            case linkBack = "LinkBack"
            case linkPreview = "LinkPreview"
            case linksBack = "LinksBack"
            case listInProject = "ListInProject"
            case listPage = "ListPage"
            case listsInProject = "ListsInProject"
            case mailSetup = "MailSetup"
            case me = "Me"
            case meActor = "MeActor"
            case meEmail = "MeEmail"
            case membership = "Membership"
            case message = "Message"
            case messageInRoom = "MessageInRoom"
            case messagePage = "MessagePage"
            case messagesImported = "MessagesImported"
            case meWorkspace = "MeWorkspace"
            case myTask = "MyTask"
            case myTaskList = "MyTaskList"
            case nameable = "Nameable"
            case nameables = "Nameables"
            case notification = "Notification"
            case notificationInInbox = "NotificationInInbox"
            case nowhereMe = "NowhereMe"
            case nowhereSession = "NowhereSession"
            case objectLink = "ObjectLink"
            case openOnPerson = "OpenOnPerson"
            case passwordChanged = "PasswordChanged"
            case passwordSet = "PasswordSet"
            case pending = "Pending"
            case peopleList = "PeopleList"
            case personDay = "PersonDay"
            case personHours = "PersonHours"
            case personInProject = "PersonInProject"
            case personInWorkspace = "PersonInWorkspace"
            case personOnPage = "PersonOnPage"
            case personPage = "PersonPage"
            case personWeek = "PersonWeek"
            case post = "Post"
            case postInList = "PostInList"
            case postInProject = "PostInProject"
            case postPage = "PostPage"
            case postPublished = "PostPublished"
            case postRead = "PostRead"
            case project = "Project"
            case projectBin = "ProjectBin"
            case projectGithub = "ProjectGithub"
            case projectInBin = "ProjectInBin"
            case projectInList = "ProjectInList"
            case projectMember = "ProjectMember"
            case projectMembers = "ProjectMembers"
            case projectPage = "ProjectPage"
            case projectSlack = "ProjectSlack"
            case providers = "Providers"
            case publicDocument = "PublicDocument"
            case publicShare = "PublicShare"
            case pullOnTask = "PullOnTask"
            case pushDevice = "PushDevice"
            case pushDevices = "PushDevices"
            case pushTried = "PushTried"
            case pushTriedDevice = "PushTriedDevice"
            case questionAnswer = "QuestionAnswer"
            case questionChoice = "QuestionChoice"
            case questionInInbox = "QuestionInInbox"
            case realtimeEvent = "RealtimeEvent"
            case recoveryCodes = "RecoveryCodes"
            case removedFrom = "RemovedFrom"
            case contractRepeat = "Repeat"
            case rewait = "Rewait"
            case roomHook = "RoomHook"
            case roomHookAddress = "RoomHookAddress"
            case roomHooks = "RoomHooks"
            case roomPeople = "RoomPeople"
            case roomPerson = "RoomPerson"
            case savedTemplate = "SavedTemplate"
            case savedTemplates = "SavedTemplates"
            case searchResult = "SearchResult"
            case searchResults = "SearchResults"
            case serverRelease = "ServerRelease"
            case serverUpdate = "ServerUpdate"
            case serverVersion = "ServerVersion"
            case session = "Session"
            case sessionRow = "SessionRow"
            case sessions = "Sessions"
            case setupMail = "SetupMail"
            case setupState = "SetupState"
            case sharedProject = "SharedProject"
            case signInCodeAsked = "SignInCodeAsked"
            case slackChannel = "SlackChannel"
            case slackChannels = "SlackChannels"
            case slackHello = "SlackHello"
            case slackLink = "SlackLink"
            case spendList = "SpendList"
            case spendOnTask = "SpendOnTask"
            case step = "Step"
            case stepChanged = "StepChanged"
            case stepMade = "StepMade"
            case subscription = "Subscription"
            case task = "Task"
            case taskCard = "TaskCard"
            case taskCardFace = "TaskCardFace"
            case taskChanged = "TaskChanged"
            case taskCopied = "TaskCopied"
            case taskDeleted = "TaskDeleted"
            case taskDuplicated = "TaskDuplicated"
            case taskInDetail = "TaskInDetail"
            case taskInList = "TaskInList"
            case taskInProject = "TaskInProject"
            case taskList = "TaskList"
            case taskPage = "TaskPage"
            case taskPicture = "TaskPicture"
            case taskPrompt = "TaskPrompt"
            case taskRead = "TaskRead"
            case taskRelated = "TaskRelated"
            case taskReminder = "TaskReminder"
            case taskReminderSet = "TaskReminderSet"
            case tasksImported = "TasksImported"
            case templateChanged = "TemplateChanged"
            case timeOnObject = "TimeOnObject"
            case tokenMade = "TokenMade"
            case tokenRow = "TokenRow"
            case tokens = "Tokens"
            case twoFactor = "TwoFactor"
            case twoFactorBegun = "TwoFactorBegun"
            case unconfirmedAnswered = "UnconfirmedAnswered"
            case unconfirmedWorkspaces = "UnconfirmedWorkspaces"
            case user = "User"
            case verified = "Verified"
            case versionContributor = "VersionContributor"
            case waitingInvitations = "WaitingInvitations"
            case wayIn = "WayIn"
            case wayInAdded = "WayInAdded"
            case wayInStart = "WayInStart"
            case waysIn = "WaysIn"
            case webhookChanged = "WebhookChanged"
            case webhookMade = "WebhookMade"
            case webhookRow = "WebhookRow"
            case webhooks = "Webhooks"
            case workspace = "Workspace"
            case workspaceAddress = "WorkspaceAddress"
            case workspaceErasing = "WorkspaceErasing"
            case workspaceImport = "WorkspaceImport"
            case workspaceImports = "WorkspaceImports"
            case workspaceInList = "WorkspaceInList"
            case workspaceList = "WorkspaceList"
            case workspaceMade = "WorkspaceMade"
            case workspaceSettings = "WorkspaceSettings"
        }

        public init(activityEvent: ActivityEvent?, activityLine: ActivityLine?, activityPage: ActivityPage?, actor: Actor?, addressLink: AddressLink?, addressLinkAccount: AddressLinkAccount?, addressLinkKind: AddressLinkKind?, agentFacePick: AgentFacePick?, agentInRoom: AgentInRoom?, agentInRoomList: AgentInRoomList?, agentList: AgentList?, agentMade: AgentMade?, agentReachChanged: AgentReachChanged?, agentRow: AgentRow?, agentStatus: AgentStatus?, agentStatusList: AgentStatusList?, agentStatusSet: AgentStatusSet?, agentTokenMade: AgentTokenMade?, agentWork: AgentWork?, agentWorkTask: AgentWorkTask?, agentWorkTasks: AgentWorkTasks?, apiError: APIError?, apiToken: APIToken?, atNumber: AtNumber?, audienceChanged: AudienceChanged?, auditEvent: AuditEvent?, auditPage: AuditPage?, auditPeople: AuditPeople?, blockerAdded: BlockerAdded?, brand: Brand?, comment: Comment?, commentOnObject: CommentOnObject?, commentsPage: CommentsPage?, conversation: Conversation?, conversationInList: ConversationInList?, conversationList: ConversationList?, count: Count?, countOrNone: CountOrNone?, created: Created?, cycleInProject: CycleInProject?, cyclesInProject: CyclesInProject?, deletedFile: DeletedFile?, deletedFilesPage: DeletedFilesPage?, deletionPlan: DeletionPlan?, directMade: DirectMade?, docVersion: DocVersion?, docVersionPage: DocVersionPage?, docVersionRead: DocVersionRead?, docVersionRestored: DocVersionRestored?, feedbackPublic: FeedbackPublic?, feedbackSettings: FeedbackSettings?, file: File?, fileChanged: FileChanged?, fileImported: FileImported?, fileInDetail: FileInDetail?, fileInList: FileInList?, fileLink: FileLink?, fileRead: FileRead?, filesInProject: FilesInProject?, forAgentsChanged: ForAgentsChanged?, gifKey: GIFKey?, githubHello: GithubHello?, githubLink: GithubLink?, githubRepo: GithubRepo?, githubRepos: GithubRepos?, hoursByPerson: HoursByPerson?, hoursList: HoursList?, importProgress: ImportProgress?, importTeam: ImportTeam?, importTeams: ImportTeams?, inbox: Inbox?, inboxCodeSent: InboxCodeSent?, inboxSettings: InboxSettings?, instance: Instance?, instanceLetter: InstanceLetter?, instanceOwner: InstanceOwner?, invite: Invite?, inviteForMe: InviteForMe?, inviteList: InviteList?, inviteMade: InviteMade?, invitePreview: InvitePreview?, inviteRow: InviteRow?, labelInProject: LabelInProject?, labelOnTask: LabelOnTask?, labelsInProject: LabelsInProject?, leftWorkspace: LeftWorkspace?, linkBack: LinkBack?, linkPreview: LinkPreview?, linksBack: LinksBack?, listInProject: ListInProject?, listPage: ListPage?, listsInProject: ListsInProject?, mailSetup: MailSetup?, me: Me?, meActor: MeActor?, meEmail: MeEmail?, membership: Membership?, message: Message?, messageInRoom: MessageInRoom?, messagePage: MessagePage?, messagesImported: MessagesImported?, meWorkspace: MeWorkspace?, myTask: MyTask?, myTaskList: MyTaskList?, nameable: Nameable?, nameables: Nameables?, notification: Notification?, notificationInInbox: NotificationInInbox?, nowhereMe: NowhereMe?, nowhereSession: NowhereSession?, objectLink: ObjectLink?, openOnPerson: OpenOnPerson?, passwordChanged: PasswordChanged?, passwordSet: PasswordSet?, pending: PendingClass?, peopleList: PeopleList?, personDay: PersonDay?, personHours: PersonHours?, personInProject: PersonInProject?, personInWorkspace: PersonInWorkspace?, personOnPage: PersonOnPage?, personPage: PersonPage?, personWeek: PersonWeek?, post: Post?, postInList: PostInList?, postInProject: PostInProject?, postPage: PostPage?, postPublished: PostPublished?, postRead: PostRead?, project: ProjectClass?, projectBin: ProjectBin?, projectGithub: ProjectGithub?, projectInBin: ProjectInBin?, projectInList: ProjectInList?, projectMember: ProjectMember?, projectMembers: ProjectMembers?, projectPage: ProjectPage?, projectSlack: ProjectSlack?, providers: Providers?, publicDocument: PublicDocument?, publicShare: PublicShare?, pullOnTask: PullOnTask?, pushDevice: PushDevice?, pushDevices: PushDevices?, pushTried: PushTried?, pushTriedDevice: PushTriedDevice?, questionAnswer: QuestionAnswer?, questionChoice: QuestionChoice?, questionInInbox: QuestionInInbox?, realtimeEvent: RealtimeEvent?, recoveryCodes: RecoveryCodes?, removedFrom: RemovedFrom?, contractRepeat: Repeat?, rewait: Rewait?, roomHook: RoomHook?, roomHookAddress: RoomHookAddress?, roomHooks: RoomHooks?, roomPeople: RoomPeople?, roomPerson: RoomPerson?, savedTemplate: SavedTemplate?, savedTemplates: SavedTemplates?, searchResult: SearchResult?, searchResults: SearchResults?, serverRelease: ServerRelease?, serverUpdate: ServerUpdate?, serverVersion: ServerVersion?, session: SessionClass?, sessionRow: SessionRow?, sessions: Sessions?, setupMail: SetupMail?, setupState: SetupState?, sharedProject: SharedProject?, signInCodeAsked: SignInCodeAsked?, slackChannel: SlackChannel?, slackChannels: SlackChannels?, slackHello: SlackHello?, slackLink: SlackLink?, spendList: SpendList?, spendOnTask: SpendOnTask?, step: Step?, stepChanged: StepChanged?, stepMade: StepMade?, subscription: Subscription?, task: Task?, taskCard: TaskCard?, taskCardFace: TaskCardFace?, taskChanged: TaskChanged?, taskCopied: TaskCopied?, taskDeleted: TaskDeleted?, taskDuplicated: TaskDuplicated?, taskInDetail: TaskInDetail?, taskInList: TaskInList?, taskInProject: TaskInProject?, taskList: TaskList?, taskPage: TaskPage?, taskPicture: TaskPicture?, taskPrompt: TaskPrompt?, taskRead: TaskRead?, taskRelated: TaskRelated?, taskReminder: TaskReminder?, taskReminderSet: TaskReminderSet?, tasksImported: TasksImported?, templateChanged: TemplateChanged?, timeOnObject: TimeOnObject?, tokenMade: TokenMade?, tokenRow: TokenRow?, tokens: Tokens?, twoFactor: TwoFactor?, twoFactorBegun: TwoFactorBegun?, unconfirmedAnswered: UnconfirmedAnswered?, unconfirmedWorkspaces: UnconfirmedWorkspaces?, user: User?, verified: Verified?, versionContributor: VersionContributor?, waitingInvitations: WaitingInvitations?, wayIn: WayIn?, wayInAdded: WayInAdded?, wayInStart: WayInStart?, waysIn: WaysIn?, webhookChanged: WebhookChanged?, webhookMade: WebhookMade?, webhookRow: WebhookRow?, webhooks: Webhooks?, workspace: WorkspaceClass?, workspaceAddress: WorkspaceAddress?, workspaceErasing: WorkspaceErasing?, workspaceImport: WorkspaceImport?, workspaceImports: WorkspaceImports?, workspaceInList: WorkspaceInList?, workspaceList: WorkspaceList?, workspaceMade: WorkspaceMade?, workspaceSettings: WorkspaceSettings?) {
            self.activityEvent = activityEvent
            self.activityLine = activityLine
            self.activityPage = activityPage
            self.actor = actor
            self.addressLink = addressLink
            self.addressLinkAccount = addressLinkAccount
            self.addressLinkKind = addressLinkKind
            self.agentFacePick = agentFacePick
            self.agentInRoom = agentInRoom
            self.agentInRoomList = agentInRoomList
            self.agentList = agentList
            self.agentMade = agentMade
            self.agentReachChanged = agentReachChanged
            self.agentRow = agentRow
            self.agentStatus = agentStatus
            self.agentStatusList = agentStatusList
            self.agentStatusSet = agentStatusSet
            self.agentTokenMade = agentTokenMade
            self.agentWork = agentWork
            self.agentWorkTask = agentWorkTask
            self.agentWorkTasks = agentWorkTasks
            self.apiError = apiError
            self.apiToken = apiToken
            self.atNumber = atNumber
            self.audienceChanged = audienceChanged
            self.auditEvent = auditEvent
            self.auditPage = auditPage
            self.auditPeople = auditPeople
            self.blockerAdded = blockerAdded
            self.brand = brand
            self.comment = comment
            self.commentOnObject = commentOnObject
            self.commentsPage = commentsPage
            self.conversation = conversation
            self.conversationInList = conversationInList
            self.conversationList = conversationList
            self.count = count
            self.countOrNone = countOrNone
            self.created = created
            self.cycleInProject = cycleInProject
            self.cyclesInProject = cyclesInProject
            self.deletedFile = deletedFile
            self.deletedFilesPage = deletedFilesPage
            self.deletionPlan = deletionPlan
            self.directMade = directMade
            self.docVersion = docVersion
            self.docVersionPage = docVersionPage
            self.docVersionRead = docVersionRead
            self.docVersionRestored = docVersionRestored
            self.feedbackPublic = feedbackPublic
            self.feedbackSettings = feedbackSettings
            self.file = file
            self.fileChanged = fileChanged
            self.fileImported = fileImported
            self.fileInDetail = fileInDetail
            self.fileInList = fileInList
            self.fileLink = fileLink
            self.fileRead = fileRead
            self.filesInProject = filesInProject
            self.forAgentsChanged = forAgentsChanged
            self.gifKey = gifKey
            self.githubHello = githubHello
            self.githubLink = githubLink
            self.githubRepo = githubRepo
            self.githubRepos = githubRepos
            self.hoursByPerson = hoursByPerson
            self.hoursList = hoursList
            self.importProgress = importProgress
            self.importTeam = importTeam
            self.importTeams = importTeams
            self.inbox = inbox
            self.inboxCodeSent = inboxCodeSent
            self.inboxSettings = inboxSettings
            self.instance = instance
            self.instanceLetter = instanceLetter
            self.instanceOwner = instanceOwner
            self.invite = invite
            self.inviteForMe = inviteForMe
            self.inviteList = inviteList
            self.inviteMade = inviteMade
            self.invitePreview = invitePreview
            self.inviteRow = inviteRow
            self.labelInProject = labelInProject
            self.labelOnTask = labelOnTask
            self.labelsInProject = labelsInProject
            self.leftWorkspace = leftWorkspace
            self.linkBack = linkBack
            self.linkPreview = linkPreview
            self.linksBack = linksBack
            self.listInProject = listInProject
            self.listPage = listPage
            self.listsInProject = listsInProject
            self.mailSetup = mailSetup
            self.me = me
            self.meActor = meActor
            self.meEmail = meEmail
            self.membership = membership
            self.message = message
            self.messageInRoom = messageInRoom
            self.messagePage = messagePage
            self.messagesImported = messagesImported
            self.meWorkspace = meWorkspace
            self.myTask = myTask
            self.myTaskList = myTaskList
            self.nameable = nameable
            self.nameables = nameables
            self.notification = notification
            self.notificationInInbox = notificationInInbox
            self.nowhereMe = nowhereMe
            self.nowhereSession = nowhereSession
            self.objectLink = objectLink
            self.openOnPerson = openOnPerson
            self.passwordChanged = passwordChanged
            self.passwordSet = passwordSet
            self.pending = pending
            self.peopleList = peopleList
            self.personDay = personDay
            self.personHours = personHours
            self.personInProject = personInProject
            self.personInWorkspace = personInWorkspace
            self.personOnPage = personOnPage
            self.personPage = personPage
            self.personWeek = personWeek
            self.post = post
            self.postInList = postInList
            self.postInProject = postInProject
            self.postPage = postPage
            self.postPublished = postPublished
            self.postRead = postRead
            self.project = project
            self.projectBin = projectBin
            self.projectGithub = projectGithub
            self.projectInBin = projectInBin
            self.projectInList = projectInList
            self.projectMember = projectMember
            self.projectMembers = projectMembers
            self.projectPage = projectPage
            self.projectSlack = projectSlack
            self.providers = providers
            self.publicDocument = publicDocument
            self.publicShare = publicShare
            self.pullOnTask = pullOnTask
            self.pushDevice = pushDevice
            self.pushDevices = pushDevices
            self.pushTried = pushTried
            self.pushTriedDevice = pushTriedDevice
            self.questionAnswer = questionAnswer
            self.questionChoice = questionChoice
            self.questionInInbox = questionInInbox
            self.realtimeEvent = realtimeEvent
            self.recoveryCodes = recoveryCodes
            self.removedFrom = removedFrom
            self.contractRepeat = contractRepeat
            self.rewait = rewait
            self.roomHook = roomHook
            self.roomHookAddress = roomHookAddress
            self.roomHooks = roomHooks
            self.roomPeople = roomPeople
            self.roomPerson = roomPerson
            self.savedTemplate = savedTemplate
            self.savedTemplates = savedTemplates
            self.searchResult = searchResult
            self.searchResults = searchResults
            self.serverRelease = serverRelease
            self.serverUpdate = serverUpdate
            self.serverVersion = serverVersion
            self.session = session
            self.sessionRow = sessionRow
            self.sessions = sessions
            self.setupMail = setupMail
            self.setupState = setupState
            self.sharedProject = sharedProject
            self.signInCodeAsked = signInCodeAsked
            self.slackChannel = slackChannel
            self.slackChannels = slackChannels
            self.slackHello = slackHello
            self.slackLink = slackLink
            self.spendList = spendList
            self.spendOnTask = spendOnTask
            self.step = step
            self.stepChanged = stepChanged
            self.stepMade = stepMade
            self.subscription = subscription
            self.task = task
            self.taskCard = taskCard
            self.taskCardFace = taskCardFace
            self.taskChanged = taskChanged
            self.taskCopied = taskCopied
            self.taskDeleted = taskDeleted
            self.taskDuplicated = taskDuplicated
            self.taskInDetail = taskInDetail
            self.taskInList = taskInList
            self.taskInProject = taskInProject
            self.taskList = taskList
            self.taskPage = taskPage
            self.taskPicture = taskPicture
            self.taskPrompt = taskPrompt
            self.taskRead = taskRead
            self.taskRelated = taskRelated
            self.taskReminder = taskReminder
            self.taskReminderSet = taskReminderSet
            self.tasksImported = tasksImported
            self.templateChanged = templateChanged
            self.timeOnObject = timeOnObject
            self.tokenMade = tokenMade
            self.tokenRow = tokenRow
            self.tokens = tokens
            self.twoFactor = twoFactor
            self.twoFactorBegun = twoFactorBegun
            self.unconfirmedAnswered = unconfirmedAnswered
            self.unconfirmedWorkspaces = unconfirmedWorkspaces
            self.user = user
            self.verified = verified
            self.versionContributor = versionContributor
            self.waitingInvitations = waitingInvitations
            self.wayIn = wayIn
            self.wayInAdded = wayInAdded
            self.wayInStart = wayInStart
            self.waysIn = waysIn
            self.webhookChanged = webhookChanged
            self.webhookMade = webhookMade
            self.webhookRow = webhookRow
            self.webhooks = webhooks
            self.workspace = workspace
            self.workspaceAddress = workspaceAddress
            self.workspaceErasing = workspaceErasing
            self.workspaceImport = workspaceImport
            self.workspaceImports = workspaceImports
            self.workspaceInList = workspaceInList
            self.workspaceList = workspaceList
            self.workspaceMade = workspaceMade
            self.workspaceSettings = workspaceSettings
        }
    }

    // MARK: - ActivityEvent
    public struct ActivityEvent: Codable, Sendable {
        public let action: String
        public let actorID: String
        public let at: String
        public let id: String
        public let meta: [String: JSONAny]
        public let objectID: String?
        public let objectType: String?
        public let origin: Origin
        public let projectID: String?
        public let workspaceID: String

        public enum CodingKeys: String, CodingKey {
            case action
            case actorID = "actor_id"
            case at, id, meta
            case objectID = "object_id"
            case objectType = "object_type"
            case origin
            case projectID = "project_id"
            case workspaceID = "workspace_id"
        }

        public init(action: String, actorID: String, at: String, id: String, meta: [String: JSONAny], objectID: String?, objectType: String?, origin: Origin, projectID: String?, workspaceID: String) {
            self.action = action
            self.actorID = actorID
            self.at = at
            self.id = id
            self.meta = meta
            self.objectID = objectID
            self.objectType = objectType
            self.origin = origin
            self.projectID = projectID
            self.workspaceID = workspaceID
        }
    }

    public enum Origin: String, Codable, Sendable {
        case android = "android"
        case github = "github"
        case ios = "ios"
        case macos = "macos"
        case mcp = "mcp"
        case originImport = "import"
        case system = "system"
        case web = "web"
    }

    // MARK: - ActivityLine
    public struct ActivityLine: Codable, Sendable {
        public let action: String
        public let actorAvatarURL: String?
        public let actorID: String?
        public let actorName: String?
        public let at: String
        public let id: String
        public let meta: JSONAny?
        public let objectID: String?
        public let objectNumber: CountOrNone?
        public let objectTitle, objectType, origin: String?
        public let projectID: String?
        public let projectKey, projectName, projectSlug: String?

        public enum CodingKeys: String, CodingKey {
            case action
            case actorAvatarURL = "actor_avatar_url"
            case actorID = "actor_id"
            case actorName = "actor_name"
            case at, id, meta
            case objectID = "object_id"
            case objectNumber = "object_number"
            case objectTitle = "object_title"
            case objectType = "object_type"
            case origin
            case projectID = "project_id"
            case projectKey = "project_key"
            case projectName = "project_name"
            case projectSlug = "project_slug"
        }

        public init(action: String, actorAvatarURL: String?, actorID: String?, actorName: String?, at: String, id: String, meta: JSONAny?, objectID: String?, objectNumber: CountOrNone?, objectTitle: String?, objectType: String?, origin: String?, projectID: String?, projectKey: String?, projectName: String?, projectSlug: String?) {
            self.action = action
            self.actorAvatarURL = actorAvatarURL
            self.actorID = actorID
            self.actorName = actorName
            self.at = at
            self.id = id
            self.meta = meta
            self.objectID = objectID
            self.objectNumber = objectNumber
            self.objectTitle = objectTitle
            self.objectType = objectType
            self.origin = origin
            self.projectID = projectID
            self.projectKey = projectKey
            self.projectName = projectName
            self.projectSlug = projectSlug
        }
    }

    public enum CountOrNone: Codable, Sendable {
        case double(Double)
        case string(String)
        case null

        public init(from decoder: Decoder) throws {
            let container = try decoder.singleValueContainer()
            if let x = try? container.decode(Double.self) {
                self = .double(x)
                return
            }
            if let x = try? container.decode(String.self) {
                self = .string(x)
                return
            }
            if container.decodeNil() {
                self = .null
                return
            }
            throw DecodingError.typeMismatch(CountOrNone.self, DecodingError.Context(codingPath: decoder.codingPath, debugDescription: "Wrong type for CountOrNone"))
        }

        public func encode(to encoder: Encoder) throws {
            var container = encoder.singleValueContainer()
            switch self {
            case .double(let x):
                try container.encode(x)
            case .string(let x):
                try container.encode(x)
            case .null:
                try container.encodeNil()
            }
        }
    }

    // MARK: - ActivityPage
    public struct ActivityPage: Codable, Sendable {
        public let events: [ActivityLine]
        public let nextCursor: String?

        public enum CodingKeys: String, CodingKey {
            case events
            case nextCursor = "next_cursor"
        }

        public init(events: [ActivityLine], nextCursor: String?) {
            self.events = events
            self.nextCursor = nextCursor
        }
    }

    // MARK: - Actor
    public struct Actor: Codable, Sendable {
        public let avatarURL: String?
        public let createdAt: String
        public let deletedAt: String?
        public let id: String
        public let name: String
        public let title: String?
        public let updatedAt: String

        public enum CodingKeys: String, CodingKey {
            case avatarURL = "avatar_url"
            case createdAt = "created_at"
            case deletedAt = "deleted_at"
            case id, name, title
            case updatedAt = "updated_at"
        }

        public init(avatarURL: String?, createdAt: String, deletedAt: String?, id: String, name: String, title: String?, updatedAt: String) {
            self.avatarURL = avatarURL
            self.createdAt = createdAt
            self.deletedAt = deletedAt
            self.id = id
            self.name = name
            self.title = title
            self.updatedAt = updatedAt
        }
    }

    // MARK: - AddressLink
    public struct AddressLink: Codable, Sendable {
        public let account: AddressLinkAccount
        public let email: String
        public let kind: AddressLinkKind
        public let needsSession: Bool

        public enum CodingKeys: String, CodingKey {
            case account, email, kind
            case needsSession = "needs_session"
        }

        public init(account: AddressLinkAccount, email: String, kind: AddressLinkKind, needsSession: Bool) {
            self.account = account
            self.email = email
            self.kind = kind
            self.needsSession = needsSession
        }
    }

    // MARK: - AddressLinkAccount
    public struct AddressLinkAccount: Codable, Sendable {
        public let email: String
        public let id: String
        public let name: String

        public init(email: String, id: String, name: String) {
            self.email = email
            self.id = id
            self.name = name
        }
    }

    public enum AddressLinkKind: String, Codable, Sendable {
        case approve = "approve"
        case email = "email"
    }

    // MARK: - AgentFacePick
    public struct AgentFacePick: Codable, Sendable {
        public let preset: Preset

        public init(preset: Preset) {
            self.preset = preset
        }
    }

    public enum Preset: String, Codable, Sendable {
        case blob1 = "blob-1"
        case blob2 = "blob-2"
        case blob3 = "blob-3"
        case blob4 = "blob-4"
        case bot1 = "bot-1"
        case bot10 = "bot-10"
        case bot2 = "bot-2"
        case bot3 = "bot-3"
        case bot4 = "bot-4"
        case bot5 = "bot-5"
        case bot6 = "bot-6"
        case bot7 = "bot-7"
        case bot8 = "bot-8"
        case bot9 = "bot-9"
        case geo1 = "geo-1"
        case geo2 = "geo-2"
        case geo3 = "geo-3"
        case geo4 = "geo-4"
    }

    // MARK: - AgentInRoom
    public struct AgentInRoom: Codable, Sendable {
        public let agentID: String
        public let doing: String?
        public let messageID: String?
        public let name: String
        public let threadID: String?
        public let until: String

        public enum CodingKeys: String, CodingKey {
            case agentID = "agent_id"
            case doing
            case messageID = "message_id"
            case name
            case threadID = "thread_id"
            case until
        }

        public init(agentID: String, doing: String?, messageID: String?, name: String, threadID: String?, until: String) {
            self.agentID = agentID
            self.doing = doing
            self.messageID = messageID
            self.name = name
            self.threadID = threadID
            self.until = until
        }
    }

    // MARK: - AgentInRoomList
    public struct AgentInRoomList: Codable, Sendable {
        public let working: [AgentInRoom]

        public init(working: [AgentInRoom]) {
            self.working = working
        }
    }

    // MARK: - AgentList
    public struct AgentList: Codable, Sendable {
        public let agents: [AgentRow]

        public init(agents: [AgentRow]) {
            self.agents = agents
        }
    }

    // MARK: - AgentRow
    public struct AgentRow: Codable, Sendable {
        public let activeAt: String?
        public let actorID: String
        public let authorizationSet: Bool?
        public let avatarURL: String?
        public let canDisconnect, canManage: Bool
        public let connections: [ConnectionElement]?
        public let createdAt: String
        public let createdBy: String
        public let createdByName, name: String
        public let offeredProjectIDS, projectIDS: [String]
        public let reach: String
        public let status: AgentStatus?
        public let stopped: Bool?
        public let webhookShape: String?
        public let webhookStopped: Bool?
        public let webhookURL: String?

        public enum CodingKeys: String, CodingKey {
            case activeAt = "active_at"
            case actorID = "actor_id"
            case authorizationSet = "authorization_set"
            case avatarURL = "avatar_url"
            case canDisconnect = "can_disconnect"
            case canManage = "can_manage"
            case connections
            case createdAt = "created_at"
            case createdBy = "created_by"
            case createdByName = "created_by_name"
            case name
            case offeredProjectIDS = "offered_project_ids"
            case projectIDS = "project_ids"
            case reach, status, stopped
            case webhookShape = "webhook_shape"
            case webhookStopped = "webhook_stopped"
            case webhookURL = "webhook_url"
        }

        public init(activeAt: String?, actorID: String, authorizationSet: Bool?, avatarURL: String?, canDisconnect: Bool, canManage: Bool, connections: [ConnectionElement]?, createdAt: String, createdBy: String, createdByName: String, name: String, offeredProjectIDS: [String], projectIDS: [String], reach: String, status: AgentStatus?, stopped: Bool?, webhookShape: String?, webhookStopped: Bool?, webhookURL: String?) {
            self.activeAt = activeAt
            self.actorID = actorID
            self.authorizationSet = authorizationSet
            self.avatarURL = avatarURL
            self.canDisconnect = canDisconnect
            self.canManage = canManage
            self.connections = connections
            self.createdAt = createdAt
            self.createdBy = createdBy
            self.createdByName = createdByName
            self.name = name
            self.offeredProjectIDS = offeredProjectIDS
            self.projectIDS = projectIDS
            self.reach = reach
            self.status = status
            self.stopped = stopped
            self.webhookShape = webhookShape
            self.webhookStopped = webhookStopped
            self.webhookURL = webhookURL
        }
    }

    // MARK: - ConnectionElement
    public struct ConnectionElement: Codable, Sendable {
        public let client, createdAt: String
        public let id: String
        public let linkedByName: String

        public enum CodingKeys: String, CodingKey {
            case client
            case createdAt = "created_at"
            case id
            case linkedByName = "linked_by_name"
        }

        public init(client: String, createdAt: String, id: String, linkedByName: String) {
            self.client = client
            self.createdAt = createdAt
            self.id = id
            self.linkedByName = linkedByName
        }
    }

    // MARK: - AgentStatus
    public struct AgentStatus: Codable, Sendable {
        public let agentID: String
        public let at: String
        public let conversationID: String?
        public let doing: String
        public let projectID: String?
        public let since: String
        public let taskID: String?
        public let taskNumber: Int?
        public let threadID: String?
        public let until: String

        public enum CodingKeys: String, CodingKey {
            case agentID = "agent_id"
            case at
            case conversationID = "conversation_id"
            case doing
            case projectID = "project_id"
            case since
            case taskID = "task_id"
            case taskNumber = "task_number"
            case threadID = "thread_id"
            case until
        }

        public init(agentID: String, at: String, conversationID: String?, doing: String, projectID: String?, since: String, taskID: String?, taskNumber: Int?, threadID: String?, until: String) {
            self.agentID = agentID
            self.at = at
            self.conversationID = conversationID
            self.doing = doing
            self.projectID = projectID
            self.since = since
            self.taskID = taskID
            self.taskNumber = taskNumber
            self.threadID = threadID
            self.until = until
        }
    }

    // MARK: - AgentMade
    public struct AgentMade: Codable, Sendable {
        public let agentID: String
        public let secret: String?
        public let token: String

        public enum CodingKeys: String, CodingKey {
            case agentID = "agent_id"
            case secret, token
        }

        public init(agentID: String, secret: String?, token: String) {
            self.agentID = agentID
            self.secret = secret
            self.token = token
        }
    }

    // MARK: - AgentReachChanged
    public struct AgentReachChanged: Codable, Sendable {
        public let authorizationCleared, ok: Bool
        public let secret: String?

        public enum CodingKeys: String, CodingKey {
            case authorizationCleared = "authorization_cleared"
            case ok, secret
        }

        public init(authorizationCleared: Bool, ok: Bool, secret: String?) {
            self.authorizationCleared = authorizationCleared
            self.ok = ok
            self.secret = secret
        }
    }

    // MARK: - AgentStatusList
    public struct AgentStatusList: Codable, Sendable {
        public let working: [AgentStatus]

        public init(working: [AgentStatus]) {
            self.working = working
        }
    }

    // MARK: - AgentStatusSet
    public struct AgentStatusSet: Codable, Sendable {
        public let status: AgentStatus?

        public init(status: AgentStatus?) {
            self.status = status
        }
    }

    // MARK: - AgentTokenMade
    public struct AgentTokenMade: Codable, Sendable {
        public let token: String

        public init(token: String) {
            self.token = token
        }
    }

    // MARK: - AgentWork
    public struct AgentWork: Codable, Sendable {
        public let answered, asked: Count
        public let costUsd: Double?
        public let events: [ActivityLine]
        public let finished, agentWorkOpen: Count
        public let period: Period
        public let since: String
        public let spentOn: Count
        public let tokens: Double
        public let took: Count

        public enum CodingKeys: String, CodingKey {
            case answered, asked
            case costUsd = "cost_usd"
            case events, finished
            case agentWorkOpen = "open"
            case period, since
            case spentOn = "spent_on"
            case tokens, took
        }

        public init(answered: Count, asked: Count, costUsd: Double?, events: [ActivityLine], finished: Count, agentWorkOpen: Count, period: Period, since: String, spentOn: Count, tokens: Double, took: Count) {
            self.answered = answered
            self.asked = asked
            self.costUsd = costUsd
            self.events = events
            self.finished = finished
            self.agentWorkOpen = agentWorkOpen
            self.period = period
            self.since = since
            self.spentOn = spentOn
            self.tokens = tokens
            self.took = took
        }
    }

    public enum Count: Codable, Sendable {
        case double(Double)
        case string(String)

        public init(from decoder: Decoder) throws {
            let container = try decoder.singleValueContainer()
            if let x = try? container.decode(Double.self) {
                self = .double(x)
                return
            }
            if let x = try? container.decode(String.self) {
                self = .string(x)
                return
            }
            throw DecodingError.typeMismatch(Count.self, DecodingError.Context(codingPath: decoder.codingPath, debugDescription: "Wrong type for Count"))
        }

        public func encode(to encoder: Encoder) throws {
            var container = encoder.singleValueContainer()
            switch self {
            case .double(let x):
                try container.encode(x)
            case .string(let x):
                try container.encode(x)
            }
        }
    }

    public enum Period: String, Codable, Sendable {
        case month = "month"
        case week = "week"
    }

    // MARK: - AgentWorkTask
    public struct AgentWorkTask: Codable, Sendable {
        public let color, completedAt: String?
        public let costUsd: Double?
        public let dueOn, icon: String?
        public let id: String
        public let number: Int?
        public let overdue: Bool?
        public let projectID: String
        public let projectKey, projectName, projectSlug: String?
        public let questions: Count?
        public let title: String
        public let tokens: Double?

        public enum CodingKeys: String, CodingKey {
            case color
            case completedAt = "completed_at"
            case costUsd = "cost_usd"
            case dueOn = "due_on"
            case icon, id, number, overdue
            case projectID = "project_id"
            case projectKey = "project_key"
            case projectName = "project_name"
            case projectSlug = "project_slug"
            case questions, title, tokens
        }

        public init(color: String?, completedAt: String?, costUsd: Double?, dueOn: String?, icon: String?, id: String, number: Int?, overdue: Bool?, projectID: String, projectKey: String?, projectName: String?, projectSlug: String?, questions: Count?, title: String, tokens: Double?) {
            self.color = color
            self.completedAt = completedAt
            self.costUsd = costUsd
            self.dueOn = dueOn
            self.icon = icon
            self.id = id
            self.number = number
            self.overdue = overdue
            self.projectID = projectID
            self.projectKey = projectKey
            self.projectName = projectName
            self.projectSlug = projectSlug
            self.questions = questions
            self.title = title
            self.tokens = tokens
        }
    }

    // MARK: - AgentWorkTasks
    public struct AgentWorkTasks: Codable, Sendable {
        public let nextCursor: String?
        public let tasks: [AgentWorkTask]

        public enum CodingKeys: String, CodingKey {
            case nextCursor = "next_cursor"
            case tasks
        }

        public init(nextCursor: String?, tasks: [AgentWorkTask]) {
            self.nextCursor = nextCursor
            self.tasks = tasks
        }
    }

    // MARK: - APIError
    public struct APIError: Codable, Sendable {
        public let error: Error

        public init(error: Error) {
            self.error = error
        }
    }

    // MARK: - Error
    public struct Error: Codable, Sendable {
        public let code: String
        public let message: String?
        public let workspace: RemovedFrom?

        public init(code: String, message: String?, workspace: RemovedFrom?) {
            self.code = code
            self.message = message
            self.workspace = workspace
        }
    }

    // MARK: - RemovedFrom
    public struct RemovedFrom: Codable, Sendable {
        public let id: String
        public let name: String

        public init(id: String, name: String) {
            self.id = id
            self.name = name
        }
    }

    // MARK: - APIToken
    public struct APIToken: Codable, Sendable {
        public let actorID: String
        public let createdAt: String
        public let deletedAt: String?
        public let expiresAt: String
        public let id: String
        public let lastUsedAt: String?
        public let lastUsedIP: String?
        public let name: String
        public let projectIDS: [String]
        public let revokedAt: String?
        public let updatedAt: String
        public let workspaceID: String

        public enum CodingKeys: String, CodingKey {
            case actorID = "actor_id"
            case createdAt = "created_at"
            case deletedAt = "deleted_at"
            case expiresAt = "expires_at"
            case id
            case lastUsedAt = "last_used_at"
            case lastUsedIP = "last_used_ip"
            case name
            case projectIDS = "project_ids"
            case revokedAt = "revoked_at"
            case updatedAt = "updated_at"
            case workspaceID = "workspace_id"
        }

        public init(actorID: String, createdAt: String, deletedAt: String?, expiresAt: String, id: String, lastUsedAt: String?, lastUsedIP: String?, name: String, projectIDS: [String], revokedAt: String?, updatedAt: String, workspaceID: String) {
            self.actorID = actorID
            self.createdAt = createdAt
            self.deletedAt = deletedAt
            self.expiresAt = expiresAt
            self.id = id
            self.lastUsedAt = lastUsedAt
            self.lastUsedIP = lastUsedIP
            self.name = name
            self.projectIDS = projectIDS
            self.revokedAt = revokedAt
            self.updatedAt = updatedAt
            self.workspaceID = workspaceID
        }
    }

    // MARK: - AtNumber
    public struct AtNumber: Codable, Sendable {
        public let id: String
        public let kind: String

        public init(id: String, kind: String) {
            self.id = id
            self.kind = kind
        }
    }

    // MARK: - AudienceChanged
    public struct AudienceChanged: Codable, Sendable {
        public let audience: String
        public let ok: Bool
        public let readerIDS: [String]

        public enum CodingKeys: String, CodingKey {
            case audience, ok
            case readerIDS = "reader_ids"
        }

        public init(audience: String, ok: Bool, readerIDS: [String]) {
            self.audience = audience
            self.ok = ok
            self.readerIDS = readerIDS
        }
    }

    // MARK: - AuditEvent
    public struct AuditEvent: Codable, Sendable {
        public let actorID: String?
        public let actorName: String?
        public let at: String
        public let id: String
        public let ip: String?
        public let kind: String
        public let meta: JSONAny?
        public let origin: String?
        public let projectID: String?
        public let projectName: String?
        public let subjectID: String?
        public let subjectName, toName, userAgent: String?

        public enum CodingKeys: String, CodingKey {
            case actorID = "actor_id"
            case actorName = "actor_name"
            case at, id, ip, kind, meta, origin
            case projectID = "project_id"
            case projectName = "project_name"
            case subjectID = "subject_id"
            case subjectName = "subject_name"
            case toName = "to_name"
            case userAgent = "user_agent"
        }

        public init(actorID: String?, actorName: String?, at: String, id: String, ip: String?, kind: String, meta: JSONAny?, origin: String?, projectID: String?, projectName: String?, subjectID: String?, subjectName: String?, toName: String?, userAgent: String?) {
            self.actorID = actorID
            self.actorName = actorName
            self.at = at
            self.id = id
            self.ip = ip
            self.kind = kind
            self.meta = meta
            self.origin = origin
            self.projectID = projectID
            self.projectName = projectName
            self.subjectID = subjectID
            self.subjectName = subjectName
            self.toName = toName
            self.userAgent = userAgent
        }
    }

    // MARK: - AuditPage
    public struct AuditPage: Codable, Sendable {
        public let events: [AuditEvent]
        public let nextCursor: String?

        public enum CodingKeys: String, CodingKey {
            case events
            case nextCursor = "next_cursor"
        }

        public init(events: [AuditEvent], nextCursor: String?) {
            self.events = events
            self.nextCursor = nextCursor
        }
    }

    // MARK: - AuditPeople
    public struct AuditPeople: Codable, Sendable {
        public let people: [Person]

        public init(people: [Person]) {
            self.people = people
        }
    }

    // MARK: - Person
    public struct Person: Codable, Sendable {
        public let actorID: String
        public let here: Bool
        public let name: String

        public enum CodingKeys: String, CodingKey {
            case actorID = "actor_id"
            case here, name
        }

        public init(actorID: String, here: Bool, name: String) {
            self.actorID = actorID
            self.here = here
            self.name = name
        }
    }

    // MARK: - BlockerAdded
    public struct BlockerAdded: Codable, Sendable {
        public let blocker: TaskRelated

        public init(blocker: TaskRelated) {
            self.blocker = blocker
        }
    }

    // MARK: - TaskRelated
    public struct TaskRelated: Codable, Sendable {
        public let completedAt: String?
        public let id: String
        public let listColor, listIcon: String?
        public let number: Int
        public let projectID: String
        public let projectKey: String
        public let projectSlug: String?
        public let title: String

        public enum CodingKeys: String, CodingKey {
            case completedAt = "completed_at"
            case id
            case listColor = "list_color"
            case listIcon = "list_icon"
            case number
            case projectID = "project_id"
            case projectKey = "project_key"
            case projectSlug = "project_slug"
            case title
        }

        public init(completedAt: String?, id: String, listColor: String?, listIcon: String?, number: Int, projectID: String, projectKey: String, projectSlug: String?, title: String) {
            self.completedAt = completedAt
            self.id = id
            self.listColor = listColor
            self.listIcon = listIcon
            self.number = number
            self.projectID = projectID
            self.projectKey = projectKey
            self.projectSlug = projectSlug
            self.title = title
        }
    }

    // MARK: - Brand
    public struct Brand: Codable, Sendable {
        public let iconURL, markIcon: String?
        public let markTint: Int
        public let name: String

        public enum CodingKeys: String, CodingKey {
            case iconURL = "icon_url"
            case markIcon = "mark_icon"
            case markTint = "mark_tint"
            case name
        }

        public init(iconURL: String?, markIcon: String?, markTint: Int, name: String) {
            self.iconURL = iconURL
            self.markIcon = markIcon
            self.markTint = markTint
            self.name = name
        }
    }

    // MARK: - Comment
    public struct Comment: Codable, Sendable {
        public let authorID: String
        public let body: [String: JSONAny]
        public let createdAt: String
        public let deletedAt: String?
        public let id, objectID: String
        public let objectType: ObjectTypeEnum
        public let origin: Origin
        public let updatedAt: String
        public let workspaceID: String

        public enum CodingKeys: String, CodingKey {
            case authorID = "author_id"
            case body
            case createdAt = "created_at"
            case deletedAt = "deleted_at"
            case id
            case objectID = "object_id"
            case objectType = "object_type"
            case origin
            case updatedAt = "updated_at"
            case workspaceID = "workspace_id"
        }

        public init(authorID: String, body: [String: JSONAny], createdAt: String, deletedAt: String?, id: String, objectID: String, objectType: ObjectTypeEnum, origin: Origin, updatedAt: String, workspaceID: String) {
            self.authorID = authorID
            self.body = body
            self.createdAt = createdAt
            self.deletedAt = deletedAt
            self.id = id
            self.objectID = objectID
            self.objectType = objectType
            self.origin = origin
            self.updatedAt = updatedAt
            self.workspaceID = workspaceID
        }
    }

    public enum ObjectTypeEnum: String, Codable, Sendable {
        case file = "file"
        case message = "message"
        case post = "post"
        case task = "task"
    }

    // MARK: - CommentOnObject
    public struct CommentOnObject: Codable, Sendable {
        public let answer: Int?
        public let answeredAt: String?
        public let answeredBy: String?
        public let answeredByName: String?
        public let asked: [String]?
        public let authorAvatarURL: String?
        public let authorID: String
        public let authorName: String
        public let body: [String: JSONAny]
        public let choices: [QuestionChoice]?
        public let createdAt: String
        public let deletedAt: String?
        public let editedAt: String?
        public let id: String
        public let objectID: String?
        public let objectType: ObjectTypeEnum?
        public let onDeletedText: Bool?
        public let origin: Origin
        public let parentID, quote, resolvedAt, resolvedBy: String?
        public let resolvedByName: String?
        public let updatedAt: String?
        public let workspaceID: String?

        public enum CodingKeys: String, CodingKey {
            case answer
            case answeredAt = "answered_at"
            case answeredBy = "answered_by"
            case answeredByName = "answered_by_name"
            case asked
            case authorAvatarURL = "author_avatar_url"
            case authorID = "author_id"
            case authorName = "author_name"
            case body, choices
            case createdAt = "created_at"
            case deletedAt = "deleted_at"
            case editedAt = "edited_at"
            case id
            case objectID = "object_id"
            case objectType = "object_type"
            case onDeletedText = "on_deleted_text"
            case origin
            case parentID = "parent_id"
            case quote
            case resolvedAt = "resolved_at"
            case resolvedBy = "resolved_by"
            case resolvedByName = "resolved_by_name"
            case updatedAt = "updated_at"
            case workspaceID = "workspace_id"
        }

        public init(answer: Int?, answeredAt: String?, answeredBy: String?, answeredByName: String?, asked: [String]?, authorAvatarURL: String?, authorID: String, authorName: String, body: [String: JSONAny], choices: [QuestionChoice]?, createdAt: String, deletedAt: String?, editedAt: String?, id: String, objectID: String?, objectType: ObjectTypeEnum?, onDeletedText: Bool?, origin: Origin, parentID: String?, quote: String?, resolvedAt: String?, resolvedBy: String?, resolvedByName: String?, updatedAt: String?, workspaceID: String?) {
            self.answer = answer
            self.answeredAt = answeredAt
            self.answeredBy = answeredBy
            self.answeredByName = answeredByName
            self.asked = asked
            self.authorAvatarURL = authorAvatarURL
            self.authorID = authorID
            self.authorName = authorName
            self.body = body
            self.choices = choices
            self.createdAt = createdAt
            self.deletedAt = deletedAt
            self.editedAt = editedAt
            self.id = id
            self.objectID = objectID
            self.objectType = objectType
            self.onDeletedText = onDeletedText
            self.origin = origin
            self.parentID = parentID
            self.quote = quote
            self.resolvedAt = resolvedAt
            self.resolvedBy = resolvedBy
            self.resolvedByName = resolvedByName
            self.updatedAt = updatedAt
            self.workspaceID = workspaceID
        }
    }

    // MARK: - QuestionChoice
    public struct QuestionChoice: Codable, Sendable {
        public let label: String
        public let recommended: Bool

        public init(label: String, recommended: Bool) {
            self.label = label
            self.recommended = recommended
        }
    }

    // MARK: - CommentsPage
    public struct CommentsPage: Codable, Sendable {
        public let comments: [CommentOnObject]
        public let nextCursor: String?

        public enum CodingKeys: String, CodingKey {
            case comments
            case nextCursor = "next_cursor"
        }

        public init(comments: [CommentOnObject], nextCursor: String?) {
            self.comments = comments
            self.nextCursor = nextCursor
        }
    }

    // MARK: - Repeat
    public struct Repeat: Codable, Sendable {
        public let day: Int?
        public let every: Every
        public let from: From?
        public let interval: Int?
        public let month: Int?
        public let weekdays: [Int]?

        public init(day: Int?, every: Every, from: From?, interval: Int?, month: Int?, weekdays: [Int]?) {
            self.day = day
            self.every = every
            self.from = from
            self.interval = interval
            self.month = month
            self.weekdays = weekdays
        }
    }

    public enum Every: String, Codable, Sendable {
        case day = "day"
        case month = "month"
        case week = "week"
        case year = "year"
    }

    public enum From: String, Codable, Sendable {
        case done = "done"
        case due = "due"
    }

    // MARK: - Conversation
    public struct Conversation: Codable, Sendable {
        public let createdAt: String
        public let deletedAt: String?
        public let id: String
        public let name: String?
        public let projectID: String?
        public let updatedAt: String
        public let workspaceID: String

        public enum CodingKeys: String, CodingKey {
            case createdAt = "created_at"
            case deletedAt = "deleted_at"
            case id, name
            case projectID = "project_id"
            case updatedAt = "updated_at"
            case workspaceID = "workspace_id"
        }

        public init(createdAt: String, deletedAt: String?, id: String, name: String?, projectID: String?, updatedAt: String, workspaceID: String) {
            self.createdAt = createdAt
            self.deletedAt = deletedAt
            self.id = id
            self.name = name
            self.projectID = projectID
            self.updatedAt = updatedAt
            self.workspaceID = workspaceID
        }
    }

    // MARK: - ConversationInList
    public struct ConversationInList: Codable, Sendable {
        public let can: [String]?
        public let channel, chosen: Bool?
        public let createdAt: String?
        public let hidden: Bool?
        public let id: String
        public let conversationInListLeft: Bool?
        public let mentions: Count?
        public let name: String?
        public let notify: String?
        public let otherAvatarURL: String?
        public let otherID: String?
        public let otherPresence, others: String?
        public let othersGone: Bool?
        public let projectArchived: Bool?
        public let projectID: String?
        public let projectSlug, readThrough: String?
        public let unread: Count?

        public enum CodingKeys: String, CodingKey {
            case can, channel, chosen
            case createdAt = "created_at"
            case hidden, id
            case conversationInListLeft = "left"
            case mentions, name, notify
            case otherAvatarURL = "other_avatar_url"
            case otherID = "other_id"
            case otherPresence = "other_presence"
            case others
            case othersGone = "others_gone"
            case projectArchived = "project_archived"
            case projectID = "project_id"
            case projectSlug = "project_slug"
            case readThrough = "read_through"
            case unread
        }

        public init(can: [String]?, channel: Bool?, chosen: Bool?, createdAt: String?, hidden: Bool?, id: String, conversationInListLeft: Bool?, mentions: Count?, name: String?, notify: String?, otherAvatarURL: String?, otherID: String?, otherPresence: String?, others: String?, othersGone: Bool?, projectArchived: Bool?, projectID: String?, projectSlug: String?, readThrough: String?, unread: Count?) {
            self.can = can
            self.channel = channel
            self.chosen = chosen
            self.createdAt = createdAt
            self.hidden = hidden
            self.id = id
            self.conversationInListLeft = conversationInListLeft
            self.mentions = mentions
            self.name = name
            self.notify = notify
            self.otherAvatarURL = otherAvatarURL
            self.otherID = otherID
            self.otherPresence = otherPresence
            self.others = others
            self.othersGone = othersGone
            self.projectArchived = projectArchived
            self.projectID = projectID
            self.projectSlug = projectSlug
            self.readThrough = readThrough
            self.unread = unread
        }
    }

    // MARK: - ConversationList
    public struct ConversationList: Codable, Sendable {
        public let conversations: [ConversationInList]

        public init(conversations: [ConversationInList]) {
            self.conversations = conversations
        }
    }

    // MARK: - Created
    public struct Created: Codable, Sendable {
        public let id: String
        public let number: Int?

        public init(id: String, number: Int?) {
            self.id = id
            self.number = number
        }
    }

    // MARK: - CycleInProject
    public struct CycleInProject: Codable, Sendable {
        public let endsOn: String?
        public let id: String
        public let name: String
        public let startsOn: String?
        public let tasks: Count?

        public enum CodingKeys: String, CodingKey {
            case endsOn = "ends_on"
            case id, name
            case startsOn = "starts_on"
            case tasks
        }

        public init(endsOn: String?, id: String, name: String, startsOn: String?, tasks: Count?) {
            self.endsOn = endsOn
            self.id = id
            self.name = name
            self.startsOn = startsOn
            self.tasks = tasks
        }
    }

    // MARK: - CyclesInProject
    public struct CyclesInProject: Codable, Sendable {
        public let cycles: [CycleInProject]

        public init(cycles: [CycleInProject]) {
            self.cycles = cycles
        }
    }

    // MARK: - DeletedFile
    public struct DeletedFile: Codable, Sendable {
        public let authorID: String?
        public let authorName, contentType: String?
        public let deletedAt: String
        public let deletedBy: String?
        public let deletedByName: String?
        public let heldFiles: Int?
        public let id: String
        public let kind: String
        public let markIcon: String?
        public let markTint: Int?
        public let name: String
        public let number: Int?
        public let purgeAt: String
        public let sizeBytes: CountOrNone?
        public let thumbURL, url: String?

        public enum CodingKeys: String, CodingKey {
            case authorID = "author_id"
            case authorName = "author_name"
            case contentType = "content_type"
            case deletedAt = "deleted_at"
            case deletedBy = "deleted_by"
            case deletedByName = "deleted_by_name"
            case heldFiles = "held_files"
            case id, kind
            case markIcon = "mark_icon"
            case markTint = "mark_tint"
            case name, number
            case purgeAt = "purge_at"
            case sizeBytes = "size_bytes"
            case thumbURL = "thumb_url"
            case url
        }

        public init(authorID: String?, authorName: String?, contentType: String?, deletedAt: String, deletedBy: String?, deletedByName: String?, heldFiles: Int?, id: String, kind: String, markIcon: String?, markTint: Int?, name: String, number: Int?, purgeAt: String, sizeBytes: CountOrNone?, thumbURL: String?, url: String?) {
            self.authorID = authorID
            self.authorName = authorName
            self.contentType = contentType
            self.deletedAt = deletedAt
            self.deletedBy = deletedBy
            self.deletedByName = deletedByName
            self.heldFiles = heldFiles
            self.id = id
            self.kind = kind
            self.markIcon = markIcon
            self.markTint = markTint
            self.name = name
            self.number = number
            self.purgeAt = purgeAt
            self.sizeBytes = sizeBytes
            self.thumbURL = thumbURL
            self.url = url
        }
    }

    // MARK: - DeletedFilesPage
    public struct DeletedFilesPage: Codable, Sendable {
        public let files: [DeletedFile]
        public let keptDays: Int
        public let nextCursor: String?

        public enum CodingKeys: String, CodingKey {
            case files
            case keptDays = "kept_days"
            case nextCursor = "next_cursor"
        }

        public init(files: [DeletedFile], keptDays: Int, nextCursor: String?) {
            self.files = files
            self.keptDays = keptDays
            self.nextCursor = nextCursor
        }
    }

    // MARK: - DeletionPlan
    public struct DeletionPlan: Codable, Sendable {
        public let alone: [Alone]?
        public let asks: String?
        public let blocked: [Blocked]?
        public let leaves: [Leaf]?
        public let ok: Bool
        public let why: String?

        public init(alone: [Alone]?, asks: String?, blocked: [Blocked]?, leaves: [Leaf]?, ok: Bool, why: String?) {
            self.alone = alone
            self.asks = asks
            self.blocked = blocked
            self.leaves = leaves
            self.ok = ok
            self.why = why
        }
    }

    // MARK: - Alone
    public struct Alone: Codable, Sendable {
        public let name: String

        public init(name: String) {
            self.name = name
        }
    }

    // MARK: - Blocked
    public struct Blocked: Codable, Sendable {
        public let name: String
        public let people: Int

        public init(name: String, people: Int) {
            self.name = name
            self.people = people
        }
    }

    // MARK: - Leaf
    public struct Leaf: Codable, Sendable {
        public let name: String

        public init(name: String) {
            self.name = name
        }
    }

    // MARK: - DirectMade
    public struct DirectMade: Codable, Sendable {
        public let id: String

        public init(id: String) {
            self.id = id
        }
    }

    // MARK: - DocVersion
    public struct DocVersion: Codable, Sendable {
        public let contributors: [VersionContributor]
        public let createdAt: String
        public let id: String
        public let restoredVersion: Int?
        public let version: Int

        public enum CodingKeys: String, CodingKey {
            case contributors
            case createdAt = "created_at"
            case id
            case restoredVersion = "restored_version"
            case version
        }

        public init(contributors: [VersionContributor], createdAt: String, id: String, restoredVersion: Int?, version: Int) {
            self.contributors = contributors
            self.createdAt = createdAt
            self.id = id
            self.restoredVersion = restoredVersion
            self.version = version
        }
    }

    // MARK: - VersionContributor
    public struct VersionContributor: Codable, Sendable {
        public let actorID: String
        public let avatarURL: String?
        public let name: String

        public enum CodingKeys: String, CodingKey {
            case actorID = "actor_id"
            case avatarURL = "avatar_url"
            case name
        }

        public init(actorID: String, avatarURL: String?, name: String) {
            self.actorID = actorID
            self.avatarURL = avatarURL
            self.name = name
        }
    }

    // MARK: - DocVersionPage
    public struct DocVersionPage: Codable, Sendable {
        public let nextCursor: String?
        public let versions: [DocVersion]

        public enum CodingKeys: String, CodingKey {
            case nextCursor = "next_cursor"
            case versions
        }

        public init(nextCursor: String?, versions: [DocVersion]) {
            self.nextCursor = nextCursor
            self.versions = versions
        }
    }

    // MARK: - DocVersionRead
    public struct DocVersionRead: Codable, Sendable {
        public let version: Version

        public init(version: Version) {
            self.version = version
        }
    }

    // MARK: - Version
    public struct Version: Codable, Sendable {
        public let body: [String: JSONAny]
        public let contributors: [VersionContributor]
        public let createdAt: String
        public let id: String
        public let restoredVersion: Int?
        public let version: Int

        public enum CodingKeys: String, CodingKey {
            case body, contributors
            case createdAt = "created_at"
            case id
            case restoredVersion = "restored_version"
            case version
        }

        public init(body: [String: JSONAny], contributors: [VersionContributor], createdAt: String, id: String, restoredVersion: Int?, version: Int) {
            self.body = body
            self.contributors = contributors
            self.createdAt = createdAt
            self.id = id
            self.restoredVersion = restoredVersion
            self.version = version
        }
    }

    // MARK: - DocVersionRestored
    public struct DocVersionRestored: Codable, Sendable {
        public let ok: Bool
        public let version: Int

        public init(ok: Bool, version: Int) {
            self.ok = ok
            self.version = version
        }
    }

    // MARK: - FeedbackPublic
    public struct FeedbackPublic: Codable, Sendable {
        public let available: Bool
        public let brand: Brand?
        public let intro: String?
        public let mark: Mark
        public let movedTo: String?
        public let name, slug: String
        public let turnstileSiteKey: String?

        public enum CodingKeys: String, CodingKey {
            case available, brand, intro, mark
            case movedTo = "moved_to"
            case name, slug
            case turnstileSiteKey = "turnstile_site_key"
        }

        public init(available: Bool, brand: Brand?, intro: String?, mark: Mark, movedTo: String?, name: String, slug: String, turnstileSiteKey: String?) {
            self.available = available
            self.brand = brand
            self.intro = intro
            self.mark = mark
            self.movedTo = movedTo
            self.name = name
            self.slug = slug
            self.turnstileSiteKey = turnstileSiteKey
        }
    }

    // MARK: - Mark
    public struct Mark: Codable, Sendable {
        public let icon: String
        public let tint: Int
        public let url: String?

        public init(icon: String, tint: Int, url: String?) {
            self.icon = icon
            self.tint = tint
            self.url = url
        }
    }

    // MARK: - FeedbackSettings
    public struct FeedbackSettings: Codable, Sendable {
        public let following, may: Bool
        public let page: Page?
        public let paid: Bool
        public let suggestedSlug: String
        public let triage: Bool

        public enum CodingKeys: String, CodingKey {
            case following, may, page, paid
            case suggestedSlug = "suggested_slug"
            case triage
        }

        public init(following: Bool, may: Bool, page: Page?, paid: Bool, suggestedSlug: String, triage: Bool) {
            self.following = following
            self.may = may
            self.page = page
            self.paid = paid
            self.suggestedSlug = suggestedSlug
            self.triage = triage
        }
    }

    // MARK: - Page
    public struct Page: Codable, Sendable {
        public let id: String
        public let intro: String?
        public let live: Bool
        public let name, slug: String

        public init(id: String, intro: String?, live: Bool, name: String, slug: String) {
            self.id = id
            self.intro = intro
            self.live = live
            self.name = name
            self.slug = slug
        }
    }

    // MARK: - File
    public struct File: Codable, Sendable {
        public let authorID: String
        public let body: [String: JSONAny]?
        public let contentType: String?
        public let createdAt: String
        public let deletedAt: String?
        public let folderID: String?
        public let id: String
        public let markIcon: String?
        public let markTint: Int?
        public let mayEdit: Bool?
        public let name: String
        public let number: Int
        public let pixelHeight, pixelWidth: Int?
        public let projectID: String
        public let rev: Int?
        public let sizeBytes: Int?
        public let updatedAt: String
        public let upload: Bool
        public let version: Int
        public let workspaceID: String

        public enum CodingKeys: String, CodingKey {
            case authorID = "author_id"
            case body
            case contentType = "content_type"
            case createdAt = "created_at"
            case deletedAt = "deleted_at"
            case folderID = "folder_id"
            case id
            case markIcon = "mark_icon"
            case markTint = "mark_tint"
            case mayEdit = "may_edit"
            case name, number
            case pixelHeight = "pixel_height"
            case pixelWidth = "pixel_width"
            case projectID = "project_id"
            case rev
            case sizeBytes = "size_bytes"
            case updatedAt = "updated_at"
            case upload, version
            case workspaceID = "workspace_id"
        }

        public init(authorID: String, body: [String: JSONAny]?, contentType: String?, createdAt: String, deletedAt: String?, folderID: String?, id: String, markIcon: String?, markTint: Int?, mayEdit: Bool?, name: String, number: Int, pixelHeight: Int?, pixelWidth: Int?, projectID: String, rev: Int?, sizeBytes: Int?, updatedAt: String, upload: Bool, version: Int, workspaceID: String) {
            self.authorID = authorID
            self.body = body
            self.contentType = contentType
            self.createdAt = createdAt
            self.deletedAt = deletedAt
            self.folderID = folderID
            self.id = id
            self.markIcon = markIcon
            self.markTint = markTint
            self.mayEdit = mayEdit
            self.name = name
            self.number = number
            self.pixelHeight = pixelHeight
            self.pixelWidth = pixelWidth
            self.projectID = projectID
            self.rev = rev
            self.sizeBytes = sizeBytes
            self.updatedAt = updatedAt
            self.upload = upload
            self.version = version
            self.workspaceID = workspaceID
        }
    }

    // MARK: - FileChanged
    public struct FileChanged: Codable, Sendable {
        public let conflicts: Int?
        public let ok: Bool
        public let rev, version: Int?

        public init(conflicts: Int?, ok: Bool, rev: Int?, version: Int?) {
            self.conflicts = conflicts
            self.ok = ok
            self.rev = rev
            self.version = version
        }
    }

    // MARK: - FileImported
    public struct FileImported: Codable, Sendable {
        public let contentType: String
        public let id: String
        public let name: String
        public let size: Int

        public enum CodingKeys: String, CodingKey {
            case contentType = "content_type"
            case id, name, size
        }

        public init(contentType: String, id: String, name: String, size: Int) {
            self.contentType = contentType
            self.id = id
            self.name = name
            self.size = size
        }
    }

    // MARK: - FileInDetail
    public struct FileInDetail: Codable, Sendable {
        public let audience: String?
        public let authorID: String?
        public let authorName: String?
        public let body: [String: JSONAny]?
        public let contentType: String?
        public let conversationID: String?
        public let createdAt: String?
        public let forAgents: Bool?
        public let id: String
        public let looseFiles: Int?
        public let markIcon: String?
        public let markTint: Int?
        public let mayEdit, mayForAgents, mayShare: Bool?
        public let name: String
        public let number: Int?
        public let originID: String?
        public let originType, pinnedAt: String?
        public let pixelHeight, pixelWidth: Int?
        public let projectID: String?
        public let publicToken: String?
        public let readerIDS: [String]?
        public let sizeBytes: CountOrNone?
        public let subscribed: Bool?
        public let templateAt, updatedAt: String?
        public let upload: Bool?
        public let url: String?
        public let version: Int?

        public enum CodingKeys: String, CodingKey {
            case audience
            case authorID = "author_id"
            case authorName = "author_name"
            case body
            case contentType = "content_type"
            case conversationID = "conversation_id"
            case createdAt = "created_at"
            case forAgents = "for_agents"
            case id
            case looseFiles = "loose_files"
            case markIcon = "mark_icon"
            case markTint = "mark_tint"
            case mayEdit = "may_edit"
            case mayForAgents = "may_for_agents"
            case mayShare = "may_share"
            case name, number
            case originID = "origin_id"
            case originType = "origin_type"
            case pinnedAt = "pinned_at"
            case pixelHeight = "pixel_height"
            case pixelWidth = "pixel_width"
            case projectID = "project_id"
            case publicToken = "public_token"
            case readerIDS = "reader_ids"
            case sizeBytes = "size_bytes"
            case subscribed
            case templateAt = "template_at"
            case updatedAt = "updated_at"
            case upload, url, version
        }

        public init(audience: String?, authorID: String?, authorName: String?, body: [String: JSONAny]?, contentType: String?, conversationID: String?, createdAt: String?, forAgents: Bool?, id: String, looseFiles: Int?, markIcon: String?, markTint: Int?, mayEdit: Bool?, mayForAgents: Bool?, mayShare: Bool?, name: String, number: Int?, originID: String?, originType: String?, pinnedAt: String?, pixelHeight: Int?, pixelWidth: Int?, projectID: String?, publicToken: String?, readerIDS: [String]?, sizeBytes: CountOrNone?, subscribed: Bool?, templateAt: String?, updatedAt: String?, upload: Bool?, url: String?, version: Int?) {
            self.audience = audience
            self.authorID = authorID
            self.authorName = authorName
            self.body = body
            self.contentType = contentType
            self.conversationID = conversationID
            self.createdAt = createdAt
            self.forAgents = forAgents
            self.id = id
            self.looseFiles = looseFiles
            self.markIcon = markIcon
            self.markTint = markTint
            self.mayEdit = mayEdit
            self.mayForAgents = mayForAgents
            self.mayShare = mayShare
            self.name = name
            self.number = number
            self.originID = originID
            self.originType = originType
            self.pinnedAt = pinnedAt
            self.pixelHeight = pixelHeight
            self.pixelWidth = pixelWidth
            self.projectID = projectID
            self.publicToken = publicToken
            self.readerIDS = readerIDS
            self.sizeBytes = sizeBytes
            self.subscribed = subscribed
            self.templateAt = templateAt
            self.updatedAt = updatedAt
            self.upload = upload
            self.url = url
            self.version = version
        }
    }

    // MARK: - FileInList
    public struct FileInList: Codable, Sendable {
        public let audience: String?
        public let authorID: String?
        public let authorName, contentType: String?
        public let createdAt: String?
        public let forAgents: Bool?
        public let id: String
        public let isDocument, isPublic: Bool?
        public let kind: String
        public let markIcon: String?
        public let markTint: Int?
        public let name: String
        public let number: Int?
        public let originID: String?
        public let originPostTitle: String?
        public let originRoom: String?
        public let originRoomChannel: Bool?
        public let originRoomName, originRoomProjectSlug, originTaskKey: String?
        public let originTaskNumber: Int?
        public let originTaskTitle, originType, pinnedAt: String?
        public let preview: Preview?
        public let sizeBytes: CountOrNone?
        public let templateAt, thumbURL, updatedAt, url: String?
        public let version: Int?

        public enum CodingKeys: String, CodingKey {
            case audience
            case authorID = "author_id"
            case authorName = "author_name"
            case contentType = "content_type"
            case createdAt = "created_at"
            case forAgents = "for_agents"
            case id
            case isDocument = "is_document"
            case isPublic = "is_public"
            case kind
            case markIcon = "mark_icon"
            case markTint = "mark_tint"
            case name, number
            case originID = "origin_id"
            case originPostTitle = "origin_post_title"
            case originRoom = "origin_room"
            case originRoomChannel = "origin_room_channel"
            case originRoomName = "origin_room_name"
            case originRoomProjectSlug = "origin_room_project_slug"
            case originTaskKey = "origin_task_key"
            case originTaskNumber = "origin_task_number"
            case originTaskTitle = "origin_task_title"
            case originType = "origin_type"
            case pinnedAt = "pinned_at"
            case preview
            case sizeBytes = "size_bytes"
            case templateAt = "template_at"
            case thumbURL = "thumb_url"
            case updatedAt = "updated_at"
            case url, version
        }

        public init(audience: String?, authorID: String?, authorName: String?, contentType: String?, createdAt: String?, forAgents: Bool?, id: String, isDocument: Bool?, isPublic: Bool?, kind: String, markIcon: String?, markTint: Int?, name: String, number: Int?, originID: String?, originPostTitle: String?, originRoom: String?, originRoomChannel: Bool?, originRoomName: String?, originRoomProjectSlug: String?, originTaskKey: String?, originTaskNumber: Int?, originTaskTitle: String?, originType: String?, pinnedAt: String?, preview: Preview?, sizeBytes: CountOrNone?, templateAt: String?, thumbURL: String?, updatedAt: String?, url: String?, version: Int?) {
            self.audience = audience
            self.authorID = authorID
            self.authorName = authorName
            self.contentType = contentType
            self.createdAt = createdAt
            self.forAgents = forAgents
            self.id = id
            self.isDocument = isDocument
            self.isPublic = isPublic
            self.kind = kind
            self.markIcon = markIcon
            self.markTint = markTint
            self.name = name
            self.number = number
            self.originID = originID
            self.originPostTitle = originPostTitle
            self.originRoom = originRoom
            self.originRoomChannel = originRoomChannel
            self.originRoomName = originRoomName
            self.originRoomProjectSlug = originRoomProjectSlug
            self.originTaskKey = originTaskKey
            self.originTaskNumber = originTaskNumber
            self.originTaskTitle = originTaskTitle
            self.originType = originType
            self.pinnedAt = pinnedAt
            self.preview = preview
            self.sizeBytes = sizeBytes
            self.templateAt = templateAt
            self.thumbURL = thumbURL
            self.updatedAt = updatedAt
            self.url = url
            self.version = version
        }
    }

    // MARK: - Preview
    public struct Preview: Codable, Sendable {
        public let lines: [Line]
        public let picture: String?
        public let pictureURL: String?

        public enum CodingKeys: String, CodingKey {
            case lines, picture
            case pictureURL = "picture_url"
        }

        public init(lines: [Line], picture: String?, pictureURL: String?) {
            self.lines = lines
            self.picture = picture
            self.pictureURL = pictureURL
        }
    }

    // MARK: - Line
    public struct Line: Codable, Sendable {
        public let h: Int
        public let t: String

        public init(h: Int, t: String) {
            self.h = h
            self.t = t
        }
    }

    // MARK: - FileLink
    public struct FileLink: Codable, Sendable {
        public let displayURL: String?
        public let expiresIn: Double?
        public let name: String?
        public let size: Double?
        public let url: String

        public enum CodingKeys: String, CodingKey {
            case displayURL = "display_url"
            case expiresIn = "expires_in"
            case name, size, url
        }

        public init(displayURL: String?, expiresIn: Double?, name: String?, size: Double?, url: String) {
            self.displayURL = displayURL
            self.expiresIn = expiresIn
            self.name = name
            self.size = size
            self.url = url
        }
    }

    // MARK: - FileRead
    public struct FileRead: Codable, Sendable {
        public let comments: [CommentOnObject]?
        public let commentsEarlier: String?
        public let file: FileInDetail

        public enum CodingKeys: String, CodingKey {
            case comments
            case commentsEarlier = "comments_earlier"
            case file
        }

        public init(comments: [CommentOnObject]?, commentsEarlier: String?, file: FileInDetail) {
            self.comments = comments
            self.commentsEarlier = commentsEarlier
            self.file = file
        }
    }

    // MARK: - FilesInProject
    public struct FilesInProject: Codable, Sendable {
        public let files: [FileInList]
        public let kinds: [String]?
        public let nextCursor: String?

        public enum CodingKeys: String, CodingKey {
            case files, kinds
            case nextCursor = "next_cursor"
        }

        public init(files: [FileInList], kinds: [String]?, nextCursor: String?) {
            self.files = files
            self.kinds = kinds
            self.nextCursor = nextCursor
        }
    }

    // MARK: - ForAgentsChanged
    public struct ForAgentsChanged: Codable, Sendable {
        public let forAgents, ok: Bool
        public let replaced: String?

        public enum CodingKeys: String, CodingKey {
            case forAgents = "for_agents"
            case ok, replaced
        }

        public init(forAgents: Bool, ok: Bool, replaced: String?) {
            self.forAgents = forAgents
            self.ok = ok
            self.replaced = replaced
        }
    }

    // MARK: - GIFKey
    public struct GIFKey: Codable, Sendable {
        public let key: String?

        public init(key: String?) {
            self.key = key
        }
    }

    // MARK: - GithubHello
    public struct GithubHello: Codable, Sendable {
        public let canInstall, configured: Bool
        public let install: Install?

        public enum CodingKeys: String, CodingKey {
            case canInstall = "can_install"
            case configured, install
        }

        public init(canInstall: Bool, configured: Bool, install: Install?) {
            self.canInstall = canInstall
            self.configured = configured
            self.install = install
        }
    }

    // MARK: - Install
    public struct Install: Codable, Sendable {
        public let accountLogin: String
        public let accountType: String?

        public enum CodingKeys: String, CodingKey {
            case accountLogin = "account_login"
            case accountType = "account_type"
        }

        public init(accountLogin: String, accountType: String?) {
            self.accountLogin = accountLogin
            self.accountType = accountType
        }
    }

    // MARK: - GithubLink
    public struct GithubLink: Codable, Sendable {
        public let issues: Bool
        public let linkedBy: String
        public let linkedByName: String
        public let githubLinkPrivate: Bool
        public let repoID, repoName: String
        public let stoppedAt: String?

        public enum CodingKeys: String, CodingKey {
            case issues
            case linkedBy = "linked_by"
            case linkedByName = "linked_by_name"
            case githubLinkPrivate = "private"
            case repoID = "repo_id"
            case repoName = "repo_name"
            case stoppedAt = "stopped_at"
        }

        public init(issues: Bool, linkedBy: String, linkedByName: String, githubLinkPrivate: Bool, repoID: String, repoName: String, stoppedAt: String?) {
            self.issues = issues
            self.linkedBy = linkedBy
            self.linkedByName = linkedByName
            self.githubLinkPrivate = githubLinkPrivate
            self.repoID = repoID
            self.repoName = repoName
            self.stoppedAt = stoppedAt
        }
    }

    // MARK: - GithubRepo
    public struct GithubRepo: Codable, Sendable {
        public let id: Int
        public let name: String
        public let githubRepoPrivate: Bool
        public let projectID: String?

        public enum CodingKeys: String, CodingKey {
            case id, name
            case githubRepoPrivate = "private"
            case projectID = "project_id"
        }

        public init(id: Int, name: String, githubRepoPrivate: Bool, projectID: String?) {
            self.id = id
            self.name = name
            self.githubRepoPrivate = githubRepoPrivate
            self.projectID = projectID
        }
    }

    // MARK: - GithubRepos
    public struct GithubRepos: Codable, Sendable {
        public let repos: [GithubRepo]

        public init(repos: [GithubRepo]) {
            self.repos = repos
        }
    }

    // MARK: - HoursByPerson
    public struct HoursByPerson: Codable, Sendable {
        public let actorID: String
        public let actorName: String?
        public let minutes: Int
        public let projectID: String
        public let projectName: String?

        public enum CodingKeys: String, CodingKey {
            case actorID = "actor_id"
            case actorName = "actor_name"
            case minutes
            case projectID = "project_id"
            case projectName = "project_name"
        }

        public init(actorID: String, actorName: String?, minutes: Int, projectID: String, projectName: String?) {
            self.actorID = actorID
            self.actorName = actorName
            self.minutes = minutes
            self.projectID = projectID
            self.projectName = projectName
        }
    }

    // MARK: - HoursList
    public struct HoursList: Codable, Sendable {
        public let time: [HoursByPerson]

        public init(time: [HoursByPerson]) {
            self.time = time
        }
    }

    // MARK: - ImportProgress
    public struct ImportProgress: Codable, Sendable {
        public let done: Bool?
        public let issues: Int?
        public let projectID: String?
        public let reading: Int?

        public enum CodingKeys: String, CodingKey {
            case done, issues
            case projectID = "project_id"
            case reading
        }

        public init(done: Bool?, issues: Int?, projectID: String?, reading: Int?) {
            self.done = done
            self.issues = issues
            self.projectID = projectID
            self.reading = reading
        }
    }

    // MARK: - ImportTeam
    public struct ImportTeam: Codable, Sendable {
        public let id: String
        public let issues: Int
        public let key, name: String

        public init(id: String, issues: Int, key: String, name: String) {
            self.id = id
            self.issues = issues
            self.key = key
            self.name = name
        }
    }

    // MARK: - ImportTeams
    public struct ImportTeams: Codable, Sendable {
        public let teams: [ImportTeam]

        public init(teams: [ImportTeam]) {
            self.teams = teams
        }
    }

    // MARK: - Inbox
    public struct Inbox: Codable, Sendable {
        public let nextCursor: String?
        public let notifications: [NotificationInInbox]
        public let questions: [QuestionInInbox]?
        public let unread: [String: Count]?

        public enum CodingKeys: String, CodingKey {
            case nextCursor = "next_cursor"
            case notifications, questions, unread
        }

        public init(nextCursor: String?, notifications: [NotificationInInbox], questions: [QuestionInInbox]?, unread: [String: Count]?) {
            self.nextCursor = nextCursor
            self.notifications = notifications
            self.questions = questions
            self.unread = unread
        }
    }

    // MARK: - NotificationInInbox
    public struct NotificationInInbox: Codable, Sendable {
        public let byAvatarURL: String?
        public let byID: String?
        public let byName: String?
        public let createdAt: String
        public let excerpt: String?
        public let id: String
        public let kind: String?
        public let objectID: String
        public let objectType: String
        public let projectID: String?
        public let projectKey, projectName, projectSlug: String?
        public let readAt: String?
        public let reason: String
        public let roomChannel: Bool?
        public let roomName, roomOthers, said, saidBy: String?
        public let saidFiles: [String]?
        public let saidID, saidThread: String?
        public let taskNumber: Int?
        public let title, what: String?

        public enum CodingKeys: String, CodingKey {
            case byAvatarURL = "by_avatar_url"
            case byID = "by_id"
            case byName = "by_name"
            case createdAt = "created_at"
            case excerpt, id, kind
            case objectID = "object_id"
            case objectType = "object_type"
            case projectID = "project_id"
            case projectKey = "project_key"
            case projectName = "project_name"
            case projectSlug = "project_slug"
            case readAt = "read_at"
            case reason
            case roomChannel = "room_channel"
            case roomName = "room_name"
            case roomOthers = "room_others"
            case said
            case saidBy = "said_by"
            case saidFiles = "said_files"
            case saidID = "said_id"
            case saidThread = "said_thread"
            case taskNumber = "task_number"
            case title, what
        }

        public init(byAvatarURL: String?, byID: String?, byName: String?, createdAt: String, excerpt: String?, id: String, kind: String?, objectID: String, objectType: String, projectID: String?, projectKey: String?, projectName: String?, projectSlug: String?, readAt: String?, reason: String, roomChannel: Bool?, roomName: String?, roomOthers: String?, said: String?, saidBy: String?, saidFiles: [String]?, saidID: String?, saidThread: String?, taskNumber: Int?, title: String?, what: String?) {
            self.byAvatarURL = byAvatarURL
            self.byID = byID
            self.byName = byName
            self.createdAt = createdAt
            self.excerpt = excerpt
            self.id = id
            self.kind = kind
            self.objectID = objectID
            self.objectType = objectType
            self.projectID = projectID
            self.projectKey = projectKey
            self.projectName = projectName
            self.projectSlug = projectSlug
            self.readAt = readAt
            self.reason = reason
            self.roomChannel = roomChannel
            self.roomName = roomName
            self.roomOthers = roomOthers
            self.said = said
            self.saidBy = saidBy
            self.saidFiles = saidFiles
            self.saidID = saidID
            self.saidThread = saidThread
            self.taskNumber = taskNumber
            self.title = title
            self.what = what
        }
    }

    // MARK: - QuestionInInbox
    public struct QuestionInInbox: Codable, Sendable {
        public let body: [String: JSONAny]
        public let byAvatarURL: String?
        public let byID: String
        public let byName: String
        public let choices: [QuestionChoice]
        public let createdAt: String
        public let excerpt: String?
        public let id, projectID: String
        public let projectKey: String?
        public let projectName, projectSlug: String
        public let taskID: String
        public let taskNumber: Int
        public let title: String

        public enum CodingKeys: String, CodingKey {
            case body
            case byAvatarURL = "by_avatar_url"
            case byID = "by_id"
            case byName = "by_name"
            case choices
            case createdAt = "created_at"
            case excerpt, id
            case projectID = "project_id"
            case projectKey = "project_key"
            case projectName = "project_name"
            case projectSlug = "project_slug"
            case taskID = "task_id"
            case taskNumber = "task_number"
            case title
        }

        public init(body: [String: JSONAny], byAvatarURL: String?, byID: String, byName: String, choices: [QuestionChoice], createdAt: String, excerpt: String?, id: String, projectID: String, projectKey: String?, projectName: String, projectSlug: String, taskID: String, taskNumber: Int, title: String) {
            self.body = body
            self.byAvatarURL = byAvatarURL
            self.byID = byID
            self.byName = byName
            self.choices = choices
            self.createdAt = createdAt
            self.excerpt = excerpt
            self.id = id
            self.projectID = projectID
            self.projectKey = projectKey
            self.projectName = projectName
            self.projectSlug = projectSlug
            self.taskID = taskID
            self.taskNumber = taskNumber
            self.title = title
        }
    }

    // MARK: - InboxCodeSent
    public struct InboxCodeSent: Codable, Sendable {
        public let sentTo: String

        public enum CodingKeys: String, CodingKey {
            case sentTo = "sent_to"
        }

        public init(sentTo: String) {
            self.sentTo = sentTo
        }
    }

    // MARK: - InboxSettings
    public struct InboxSettings: Codable, Sendable {
        public let emailDigest, notifyChat: Bool
        public let quietFrom, quietTo, timezone: String?

        public enum CodingKeys: String, CodingKey {
            case emailDigest = "email_digest"
            case notifyChat = "notify_chat"
            case quietFrom = "quiet_from"
            case quietTo = "quiet_to"
            case timezone
        }

        public init(emailDigest: Bool, notifyChat: Bool, quietFrom: String?, quietTo: String?, timezone: String?) {
            self.emailDigest = emailDigest
            self.notifyChat = notifyChat
            self.quietFrom = quietFrom
            self.quietTo = quietTo
            self.timezone = timezone
        }
    }

    // MARK: - Instance
    public struct Instance: Codable, Sendable {
        public let mail: Bool
        public let mailSetup: MailSetup
        public let owners: [InstanceOwner]
        public let signUpOpen: Bool
        public let version: ServerVersion

        public enum CodingKeys: String, CodingKey {
            case mail
            case mailSetup = "mail_setup"
            case owners
            case signUpOpen = "sign_up_open"
            case version
        }

        public init(mail: Bool, mailSetup: MailSetup, owners: [InstanceOwner], signUpOpen: Bool, version: ServerVersion) {
            self.mail = mail
            self.mailSetup = mailSetup
            self.owners = owners
            self.signUpOpen = signUpOpen
            self.version = version
        }
    }

    // MARK: - MailSetup
    public struct MailSetup: Codable, Sendable {
        public let host: String?
        public let port: Int?
        public let secretSet: Bool
        public let security: Security?
        public let sender: String?
        public let source: MailSetupSource?
        public let user: String?
        public let via: Via?

        public enum CodingKeys: String, CodingKey {
            case host, port
            case secretSet = "secret_set"
            case security, sender, source, user, via
        }

        public init(host: String?, port: Int?, secretSet: Bool, security: Security?, sender: String?, source: MailSetupSource?, user: String?, via: Via?) {
            self.host = host
            self.port = port
            self.secretSet = secretSet
            self.security = security
            self.sender = sender
            self.source = source
            self.user = user
            self.via = via
        }
    }

    public enum Security: String, Codable, Sendable {
        case none = "none"
        case starttls = "starttls"
        case tls = "tls"
    }

    public enum MailSetupSource: String, Codable, Sendable {
        case env = "env"
        case saved = "saved"
    }

    public enum Via: String, Codable, Sendable {
        case resend = "resend"
        case smtp = "smtp"
    }

    // MARK: - InstanceOwner
    public struct InstanceOwner: Codable, Sendable {
        public let actorID: String
        public let addedAt: String
        public let email: String?
        public let name: String

        public enum CodingKeys: String, CodingKey {
            case actorID = "actor_id"
            case addedAt = "added_at"
            case email, name
        }

        public init(actorID: String, addedAt: String, email: String?, name: String) {
            self.actorID = actorID
            self.addedAt = addedAt
            self.email = email
            self.name = name
        }
    }

    // MARK: - ServerVersion
    public struct ServerVersion: Codable, Sendable {
        public let check: Bool
        public let commit, current: String
        public let latest: ServerRelease?
        public let updated: ServerUpdate?

        public init(check: Bool, commit: String, current: String, latest: ServerRelease?, updated: ServerUpdate?) {
            self.check = check
            self.commit = commit
            self.current = current
            self.latest = latest
            self.updated = updated
        }
    }

    // MARK: - ServerRelease
    public struct ServerRelease: Codable, Sendable {
        public let publishedAt: String?
        public let security: Bool
        public let url, version: String

        public enum CodingKeys: String, CodingKey {
            case publishedAt = "published_at"
            case security, url, version
        }

        public init(publishedAt: String?, security: Bool, url: String, version: String) {
            self.publishedAt = publishedAt
            self.security = security
            self.url = url
            self.version = version
        }
    }

    // MARK: - ServerUpdate
    public struct ServerUpdate: Codable, Sendable {
        public let at: String
        public let backup, from: String?
        public let migrations: Int
        public let noBackup: NoBackup?
        public let notes: String?
        public let to: String

        public enum CodingKeys: String, CodingKey {
            case at, backup, from, migrations
            case noBackup = "no_backup"
            case notes, to
        }

        public init(at: String, backup: String?, from: String?, migrations: Int, noBackup: NoBackup?, notes: String?, to: String) {
            self.at = at
            self.backup = backup
            self.from = from
            self.migrations = migrations
            self.noBackup = noBackup
            self.notes = notes
            self.to = to
        }
    }

    public enum NoBackup: String, Codable, Sendable {
        case noFolder = "no_folder"
        case notAVolume = "not_a_volume"
        case postgresNewer = "postgres_newer"
        case skipped = "skipped"
    }

    // MARK: - InstanceLetter
    public struct InstanceLetter: Codable, Sendable {
        public let mail, sent: Bool

        public init(mail: Bool, sent: Bool) {
            self.mail = mail
            self.sent = sent
        }
    }

    // MARK: - Invite
    public struct Invite: Codable, Sendable {
        public let createdAt: String
        public let createdBy: String
        public let deletedAt: String?
        public let email: String?
        public let expiresAt: String
        public let id: String
        public let projectIDS: [String]
        public let role: Role
        public let updatedAt: String
        public let usedAt: String?
        public let usedBy: String?
        public let workspaceID: String

        public enum CodingKeys: String, CodingKey {
            case createdAt = "created_at"
            case createdBy = "created_by"
            case deletedAt = "deleted_at"
            case email
            case expiresAt = "expires_at"
            case id
            case projectIDS = "project_ids"
            case role
            case updatedAt = "updated_at"
            case usedAt = "used_at"
            case usedBy = "used_by"
            case workspaceID = "workspace_id"
        }

        public init(createdAt: String, createdBy: String, deletedAt: String?, email: String?, expiresAt: String, id: String, projectIDS: [String], role: Role, updatedAt: String, usedAt: String?, usedBy: String?, workspaceID: String) {
            self.createdAt = createdAt
            self.createdBy = createdBy
            self.deletedAt = deletedAt
            self.email = email
            self.expiresAt = expiresAt
            self.id = id
            self.projectIDS = projectIDS
            self.role = role
            self.updatedAt = updatedAt
            self.usedAt = usedAt
            self.usedBy = usedBy
            self.workspaceID = workspaceID
        }
    }

    public enum Role: String, Codable, Sendable {
        case member = "member"
        case owner = "owner"
    }

    // MARK: - InviteForMe
    public struct InviteForMe: Codable, Sendable {
        public let brand: Brand?
        public let email: String?
        public let host: String?
        public let member: Bool?
        public let role: String?
        public let state: String
        public let workspaceID: String?
        public let workspaceName: String?
        public let you: You?

        public enum CodingKeys: String, CodingKey {
            case brand, email, host, member, role, state
            case workspaceID = "workspace_id"
            case workspaceName = "workspace_name"
            case you
        }

        public init(brand: Brand?, email: String?, host: String?, member: Bool?, role: String?, state: String, workspaceID: String?, workspaceName: String?, you: You?) {
            self.brand = brand
            self.email = email
            self.host = host
            self.member = member
            self.role = role
            self.state = state
            self.workspaceID = workspaceID
            self.workspaceName = workspaceName
            self.you = you
        }
    }

    // MARK: - You
    public struct You: Codable, Sendable {
        public let email: String?
        public let name: String

        public init(email: String?, name: String) {
            self.email = email
            self.name = name
        }
    }

    // MARK: - InviteList
    public struct InviteList: Codable, Sendable {
        public let invites: [InviteRow]

        public init(invites: [InviteRow]) {
            self.invites = invites
        }
    }

    // MARK: - InviteRow
    public struct InviteRow: Codable, Sendable {
        public let createdAt: String
        public let deletedAt, email: String?
        public let expiresAt: String
        public let id: String
        public let projectIDS: [String]
        public let rights: [String]
        public let role: String
        public let sendAgain: Bool?
        public let usedAt: String?
        public let usedBy: String?

        public enum CodingKeys: String, CodingKey {
            case createdAt = "created_at"
            case deletedAt = "deleted_at"
            case email
            case expiresAt = "expires_at"
            case id
            case projectIDS = "project_ids"
            case rights, role
            case sendAgain = "send_again"
            case usedAt = "used_at"
            case usedBy = "used_by"
        }

        public init(createdAt: String, deletedAt: String?, email: String?, expiresAt: String, id: String, projectIDS: [String], rights: [String], role: String, sendAgain: Bool?, usedAt: String?, usedBy: String?) {
            self.createdAt = createdAt
            self.deletedAt = deletedAt
            self.email = email
            self.expiresAt = expiresAt
            self.id = id
            self.projectIDS = projectIDS
            self.rights = rights
            self.role = role
            self.sendAgain = sendAgain
            self.usedAt = usedAt
            self.usedBy = usedBy
        }
    }

    // MARK: - InviteMade
    public struct InviteMade: Codable, Sendable {
        public let host: String?
        public let id: String
        public let mailed: Bool
        public let token: String

        public init(host: String?, id: String, mailed: Bool, token: String) {
            self.host = host
            self.id = id
            self.mailed = mailed
            self.token = token
        }
    }

    // MARK: - InvitePreview
    public struct InvitePreview: Codable, Sendable {
        public let brand: Brand?
        public let email: String?
        public let host: String?
        public let role: String?
        public let state: String
        public let workspaceName: String?

        public enum CodingKeys: String, CodingKey {
            case brand, email, host, role, state
            case workspaceName = "workspace_name"
        }

        public init(brand: Brand?, email: String?, host: String?, role: String?, state: String, workspaceName: String?) {
            self.brand = brand
            self.email = email
            self.host = host
            self.role = role
            self.state = state
            self.workspaceName = workspaceName
        }
    }

    // MARK: - LabelInProject
    public struct LabelInProject: Codable, Sendable {
        public let color: String?
        public let id: String
        public let name: String
        public let projectID: String
        public let used: Count?

        public enum CodingKeys: String, CodingKey {
            case color, id, name
            case projectID = "project_id"
            case used
        }

        public init(color: String?, id: String, name: String, projectID: String, used: Count?) {
            self.color = color
            self.id = id
            self.name = name
            self.projectID = projectID
            self.used = used
        }
    }

    // MARK: - LabelOnTask
    public struct LabelOnTask: Codable, Sendable {
        public let color: String?
        public let id: String
        public let name: String

        public init(color: String?, id: String, name: String) {
            self.color = color
            self.id = id
            self.name = name
        }
    }

    // MARK: - LabelsInProject
    public struct LabelsInProject: Codable, Sendable {
        public let labels: [LabelInProject]

        public init(labels: [LabelInProject]) {
            self.labels = labels
        }
    }

    // MARK: - LeftWorkspace
    public struct LeftWorkspace: Codable, Sendable {
        public let ok: Bool
        public let session: Session
        public let workspace: Workspace?

        public init(ok: Bool, session: Session, workspace: Workspace?) {
            self.ok = ok
            self.session = session
            self.workspace = workspace
        }
    }

    // MARK: - Session
    public struct Session: Codable, Sendable {
        public let accessToken: String
        public let actorID: String
        public let expiresIn: Int
        public let refreshToken: String
        public let workspaceID: String?
        public let nowhere: Bool?

        public enum CodingKeys: String, CodingKey {
            case accessToken = "access_token"
            case actorID = "actor_id"
            case expiresIn = "expires_in"
            case refreshToken = "refresh_token"
            case workspaceID = "workspace_id"
            case nowhere
        }

        public init(accessToken: String, actorID: String, expiresIn: Int, refreshToken: String, workspaceID: String?, nowhere: Bool?) {
            self.accessToken = accessToken
            self.actorID = actorID
            self.expiresIn = expiresIn
            self.refreshToken = refreshToken
            self.workspaceID = workspaceID
            self.nowhere = nowhere
        }
    }

    // MARK: - Workspace
    public struct Workspace: Codable, Sendable {
        public let id: String
        public let name, slug: String

        public init(id: String, name: String, slug: String) {
            self.id = id
            self.name = name
            self.slug = slug
        }
    }

    // MARK: - LinkBack
    public struct LinkBack: Codable, Sendable {
        public let id: String
        public let projectID: String?
        public let title, type: String

        public enum CodingKeys: String, CodingKey {
            case id
            case projectID = "project_id"
            case title, type
        }

        public init(id: String, projectID: String?, title: String, type: String) {
            self.id = id
            self.projectID = projectID
            self.title = title
            self.type = type
        }
    }

    // MARK: - LinkPreview
    public struct LinkPreview: Codable, Sendable {
        public let description, image, site: String?
        public let title, url: String

        public init(description: String?, image: String?, site: String?, title: String, url: String) {
            self.description = description
            self.image = image
            self.site = site
            self.title = title
            self.url = url
        }
    }

    // MARK: - LinksBack
    public struct LinksBack: Codable, Sendable {
        public let links: [LinkBack]

        public init(links: [LinkBack]) {
            self.links = links
        }
    }

    // MARK: - ListInProject
    public struct ListInProject: Codable, Sendable {
        public let agentGone: Bool?
        public let agentID: String?
        public let color: String?
        public let finishes: Bool?
        public let icon: String?
        public let id: String
        public let intake: Bool?
        public let name: String
        public let narrow: Bool?
        public let sortKey: String?
        public let tasks: Count?

        public enum CodingKeys: String, CodingKey {
            case agentGone = "agent_gone"
            case agentID = "agent_id"
            case color, finishes, icon, id, intake, name, narrow
            case sortKey = "sort_key"
            case tasks
        }

        public init(agentGone: Bool?, agentID: String?, color: String?, finishes: Bool?, icon: String?, id: String, intake: Bool?, name: String, narrow: Bool?, sortKey: String?, tasks: Count?) {
            self.agentGone = agentGone
            self.agentID = agentID
            self.color = color
            self.finishes = finishes
            self.icon = icon
            self.id = id
            self.intake = intake
            self.name = name
            self.narrow = narrow
            self.sortKey = sortKey
            self.tasks = tasks
        }
    }

    // MARK: - ListPage
    public struct ListPage: Codable, Sendable {
        public let id: String
        public let nextCursor: String?
        public let total: Int

        public enum CodingKeys: String, CodingKey {
            case id
            case nextCursor = "next_cursor"
            case total
        }

        public init(id: String, nextCursor: String?, total: Int) {
            self.id = id
            self.nextCursor = nextCursor
            self.total = total
        }
    }

    // MARK: - ListsInProject
    public struct ListsInProject: Codable, Sendable {
        public let lists: [ListInProject]

        public init(lists: [ListInProject]) {
            self.lists = lists
        }
    }

    // MARK: - Me
    public struct Me: Codable, Sendable {
        public let actor: MeActor
        public let can: [String]
        public let canOffHost: [String]?
        public let host: String?
        public let plan: String?
        public let role: String
        public let server: ServerVersion?
        public let settings: Settings?
        public let viaMCP: Bool?
        public let workspace: MeWorkspace

        public enum CodingKeys: String, CodingKey {
            case actor, can
            case canOffHost = "can_off_host"
            case host, plan, role, server, settings
            case viaMCP = "via_mcp"
            case workspace
        }

        public init(actor: MeActor, can: [String], canOffHost: [String]?, host: String?, plan: String?, role: String, server: ServerVersion?, settings: Settings?, viaMCP: Bool?, workspace: MeWorkspace) {
            self.actor = actor
            self.can = can
            self.canOffHost = canOffHost
            self.host = host
            self.plan = plan
            self.role = role
            self.server = server
            self.settings = settings
            self.viaMCP = viaMCP
            self.workspace = workspace
        }
    }

    // MARK: - MeActor
    public struct MeActor: Codable, Sendable {
        public let avatarURL, chosen: String?
        public let id: String
        public let language: String?
        public let name: String
        public let presence, timezone, title: String?

        public enum CodingKeys: String, CodingKey {
            case avatarURL = "avatar_url"
            case chosen, id, language, name, presence, timezone, title
        }

        public init(avatarURL: String?, chosen: String?, id: String, language: String?, name: String, presence: String?, timezone: String?, title: String?) {
            self.avatarURL = avatarURL
            self.chosen = chosen
            self.id = id
            self.language = language
            self.name = name
            self.presence = presence
            self.timezone = timezone
            self.title = title
        }
    }

    // MARK: - Settings
    public struct Settings: Codable, Sendable {
        public let editOthersContent: EditOthersContent?
        public let whoCreatesProjects, whoInvitesPeople, whoSeesMembers: Who?

        public enum CodingKeys: String, CodingKey {
            case editOthersContent = "edit_others_content"
            case whoCreatesProjects = "who_creates_projects"
            case whoInvitesPeople = "who_invites_people"
            case whoSeesMembers = "who_sees_members"
        }

        public init(editOthersContent: EditOthersContent?, whoCreatesProjects: Who?, whoInvitesPeople: Who?, whoSeesMembers: Who?) {
            self.editOthersContent = editOthersContent
            self.whoCreatesProjects = whoCreatesProjects
            self.whoInvitesPeople = whoInvitesPeople
            self.whoSeesMembers = whoSeesMembers
        }
    }

    public enum EditOthersContent: String, Codable, Sendable {
        case documentsToo = "documents_too"
        case ownOnly = "own_only"
    }

    public enum Who: String, Codable, Sendable {
        case members = "members"
        case owner = "owner"
    }

    // MARK: - MeWorkspace
    public struct MeWorkspace: Codable, Sendable {
        public let brand: Brand?
        public let domainStopped: Bool?
        public let iconURL: String?
        public let id: String
        public let markIcon: String?
        public let markTint: Int?
        public let name: String
        public let origin: String?
        public let slug: String

        public enum CodingKeys: String, CodingKey {
            case brand
            case domainStopped = "domain_stopped"
            case iconURL = "icon_url"
            case id
            case markIcon = "mark_icon"
            case markTint = "mark_tint"
            case name, origin, slug
        }

        public init(brand: Brand?, domainStopped: Bool?, iconURL: String?, id: String, markIcon: String?, markTint: Int?, name: String, origin: String?, slug: String) {
            self.brand = brand
            self.domainStopped = domainStopped
            self.iconURL = iconURL
            self.id = id
            self.markIcon = markIcon
            self.markTint = markTint
            self.name = name
            self.origin = origin
            self.slug = slug
        }
    }

    // MARK: - MeEmail
    public struct MeEmail: Codable, Sendable {
        public let asks: AsksClass
        public let email: String
        public let pending: Pending?

        public init(asks: AsksClass, email: String, pending: Pending?) {
            self.asks = asks
            self.email = email
            self.pending = pending
        }
    }

    // MARK: - AsksClass
    public struct AsksClass: Codable, Sendable {
        public let code: Bool
        public let inbox: Bool?
        public let password: Bool

        public init(code: Bool, inbox: Bool?, password: Bool) {
            self.code = code
            self.inbox = inbox
            self.password = password
        }
    }

    // MARK: - Pending
    public struct Pending: Codable, Sendable {
        public let approve: Bool
        public let email: String

        public init(approve: Bool, email: String) {
            self.approve = approve
            self.email = email
        }
    }

    // MARK: - Membership
    public struct Membership: Codable, Sendable {
        public let actorID: String
        public let createdAt: String
        public let deletedAt: String?
        public let id: String
        public let invitedBy: String?
        public let joinedAt: String?
        public let role: Role
        public let updatedAt: String
        public let workspaceID: String

        public enum CodingKeys: String, CodingKey {
            case actorID = "actor_id"
            case createdAt = "created_at"
            case deletedAt = "deleted_at"
            case id
            case invitedBy = "invited_by"
            case joinedAt = "joined_at"
            case role
            case updatedAt = "updated_at"
            case workspaceID = "workspace_id"
        }

        public init(actorID: String, createdAt: String, deletedAt: String?, id: String, invitedBy: String?, joinedAt: String?, role: Role, updatedAt: String, workspaceID: String) {
            self.actorID = actorID
            self.createdAt = createdAt
            self.deletedAt = deletedAt
            self.id = id
            self.invitedBy = invitedBy
            self.joinedAt = joinedAt
            self.role = role
            self.updatedAt = updatedAt
            self.workspaceID = workspaceID
        }
    }

    // MARK: - Message
    public struct Message: Codable, Sendable {
        public let authorID: String
        public let body: [String: JSONAny]
        public let conversationID: String
        public let createdAt: String
        public let deletedAt, editedAt: String?
        public let id: String
        public let origin: Origin
        public let parentID: String?
        public let updatedAt: String
        public let workspaceID: String

        public enum CodingKeys: String, CodingKey {
            case authorID = "author_id"
            case body
            case conversationID = "conversation_id"
            case createdAt = "created_at"
            case deletedAt = "deleted_at"
            case editedAt = "edited_at"
            case id, origin
            case parentID = "parent_id"
            case updatedAt = "updated_at"
            case workspaceID = "workspace_id"
        }

        public init(authorID: String, body: [String: JSONAny], conversationID: String, createdAt: String, deletedAt: String?, editedAt: String?, id: String, origin: Origin, parentID: String?, updatedAt: String, workspaceID: String) {
            self.authorID = authorID
            self.body = body
            self.conversationID = conversationID
            self.createdAt = createdAt
            self.deletedAt = deletedAt
            self.editedAt = editedAt
            self.id = id
            self.origin = origin
            self.parentID = parentID
            self.updatedAt = updatedAt
            self.workspaceID = workspaceID
        }
    }

    // MARK: - MessageInRoom
    public struct MessageInRoom: Codable, Sendable {
        public let alsoInRoom: Bool?
        public let authorAvatarURL: String?
        public let authorID: String?
        public let authorName: String
        public let body: [String: JSONAny]?
        public let conversationID: String?
        public let createdAt: String
        public let deleted: Bool?
        public let deletedAt: String?
        public let editedAt, hookID: String?
        public let id: String
        public let lastReplyAt: String?
        public let origin: Origin
        public let parentID: String?
        public let promotedTaskID: String?
        public let reactions: [Reaction]?
        public let repliers: [Replier]?
        public let replies: Count?
        public let saidAs, threadSaid: String?
        public let updatedAt: String?
        public let workspaceID: String?

        public enum CodingKeys: String, CodingKey {
            case alsoInRoom = "also_in_room"
            case authorAvatarURL = "author_avatar_url"
            case authorID = "author_id"
            case authorName = "author_name"
            case body
            case conversationID = "conversation_id"
            case createdAt = "created_at"
            case deleted
            case deletedAt = "deleted_at"
            case editedAt = "edited_at"
            case hookID = "hook_id"
            case id
            case lastReplyAt = "last_reply_at"
            case origin
            case parentID = "parent_id"
            case promotedTaskID = "promoted_task_id"
            case reactions, repliers, replies
            case saidAs = "said_as"
            case threadSaid = "thread_said"
            case updatedAt = "updated_at"
            case workspaceID = "workspace_id"
        }

        public init(alsoInRoom: Bool?, authorAvatarURL: String?, authorID: String?, authorName: String, body: [String: JSONAny]?, conversationID: String?, createdAt: String, deleted: Bool?, deletedAt: String?, editedAt: String?, hookID: String?, id: String, lastReplyAt: String?, origin: Origin, parentID: String?, promotedTaskID: String?, reactions: [Reaction]?, repliers: [Replier]?, replies: Count?, saidAs: String?, threadSaid: String?, updatedAt: String?, workspaceID: String?) {
            self.alsoInRoom = alsoInRoom
            self.authorAvatarURL = authorAvatarURL
            self.authorID = authorID
            self.authorName = authorName
            self.body = body
            self.conversationID = conversationID
            self.createdAt = createdAt
            self.deleted = deleted
            self.deletedAt = deletedAt
            self.editedAt = editedAt
            self.hookID = hookID
            self.id = id
            self.lastReplyAt = lastReplyAt
            self.origin = origin
            self.parentID = parentID
            self.promotedTaskID = promotedTaskID
            self.reactions = reactions
            self.repliers = repliers
            self.replies = replies
            self.saidAs = saidAs
            self.threadSaid = threadSaid
            self.updatedAt = updatedAt
            self.workspaceID = workspaceID
        }
    }

    // MARK: - Reaction
    public struct Reaction: Codable, Sendable {
        public let actors: [String]
        public let emoji: String

        public init(actors: [String], emoji: String) {
            self.actors = actors
            self.emoji = emoji
        }
    }

    // MARK: - Replier
    public struct Replier: Codable, Sendable {
        public let avatarURL: String?
        public let id, name: String

        public enum CodingKeys: String, CodingKey {
            case avatarURL = "avatar_url"
            case id, name
        }

        public init(avatarURL: String?, id: String, name: String) {
            self.avatarURL = avatarURL
            self.id = id
            self.name = name
        }
    }

    // MARK: - MessagePage
    public struct MessagePage: Codable, Sendable {
        public let messages: [MessageInRoom]
        public let nextCursor: String?

        public enum CodingKeys: String, CodingKey {
            case messages
            case nextCursor = "next_cursor"
        }

        public init(messages: [MessageInRoom], nextCursor: String?) {
            self.messages = messages
            self.nextCursor = nextCursor
        }
    }

    // MARK: - MessagesImported
    public struct MessagesImported: Codable, Sendable {
        public let ids: [String: String]

        public init(ids: [String: String]) {
            self.ids = ids
        }
    }

    // MARK: - MyTask
    public struct MyTask: Codable, Sendable {
        public let color, completedAt, dueOn, icon: String?
        public let id: String
        public let listName: String?
        public let number: Int
        public let projectID: String
        public let projectKey, projectName: String
        public let projectSlug: String?
        public let reminderAt: String?
        public let myTaskRepeat: Repeat?
        public let title: String

        public enum CodingKeys: String, CodingKey {
            case color
            case completedAt = "completed_at"
            case dueOn = "due_on"
            case icon, id
            case listName = "list_name"
            case number
            case projectID = "project_id"
            case projectKey = "project_key"
            case projectName = "project_name"
            case projectSlug = "project_slug"
            case reminderAt = "reminder_at"
            case myTaskRepeat = "repeat"
            case title
        }

        public init(color: String?, completedAt: String?, dueOn: String?, icon: String?, id: String, listName: String?, number: Int, projectID: String, projectKey: String, projectName: String, projectSlug: String?, reminderAt: String?, myTaskRepeat: Repeat?, title: String) {
            self.color = color
            self.completedAt = completedAt
            self.dueOn = dueOn
            self.icon = icon
            self.id = id
            self.listName = listName
            self.number = number
            self.projectID = projectID
            self.projectKey = projectKey
            self.projectName = projectName
            self.projectSlug = projectSlug
            self.reminderAt = reminderAt
            self.myTaskRepeat = myTaskRepeat
            self.title = title
        }
    }

    // MARK: - MyTaskList
    public struct MyTaskList: Codable, Sendable {
        public let tasks: [MyTask]

        public init(tasks: [MyTask]) {
            self.tasks = tasks
        }
    }

    // MARK: - Nameable
    public struct Nameable: Codable, Sendable {
        public let completedAt: String?
        public let id: String
        public let kind: String?
        public let number: Int?
        public let projectID: String
        public let projectKey: String?
        public let title: String

        public enum CodingKeys: String, CodingKey {
            case completedAt = "completed_at"
            case id, kind, number
            case projectID = "project_id"
            case projectKey = "project_key"
            case title
        }

        public init(completedAt: String?, id: String, kind: String?, number: Int?, projectID: String, projectKey: String?, title: String) {
            self.completedAt = completedAt
            self.id = id
            self.kind = kind
            self.number = number
            self.projectID = projectID
            self.projectKey = projectKey
            self.title = title
        }
    }

    // MARK: - Nameables
    public struct Nameables: Codable, Sendable {
        public let tasks: [Nameable]

        public init(tasks: [Nameable]) {
            self.tasks = tasks
        }
    }

    // MARK: - Notification
    public struct Notification: Codable, Sendable {
        public let actorID: String
        public let createdAt: String
        public let deletedAt: String?
        public let id, objectID: String
        public let objectType: String
        public let readAt: String?
        public let reason: Reason
        public let updatedAt: String
        public let workspaceID: String

        public enum CodingKeys: String, CodingKey {
            case actorID = "actor_id"
            case createdAt = "created_at"
            case deletedAt = "deleted_at"
            case id
            case objectID = "object_id"
            case objectType = "object_type"
            case readAt = "read_at"
            case reason
            case updatedAt = "updated_at"
            case workspaceID = "workspace_id"
        }

        public init(actorID: String, createdAt: String, deletedAt: String?, id: String, objectID: String, objectType: String, readAt: String?, reason: Reason, updatedAt: String, workspaceID: String) {
            self.actorID = actorID
            self.createdAt = createdAt
            self.deletedAt = deletedAt
            self.id = id
            self.objectID = objectID
            self.objectType = objectType
            self.readAt = readAt
            self.reason = reason
            self.updatedAt = updatedAt
            self.workspaceID = workspaceID
        }
    }

    public enum Reason: String, Codable, Sendable {
        case assigned = "assigned"
        case joined = "joined"
        case mentioned = "mentioned"
        case messaged = "messaged"
        case subscribed = "subscribed"
    }

    // MARK: - NowhereMe
    public struct NowhereMe: Codable, Sendable {
        public let actor: ActorClass
        public let can: [String]
        public let email: String
        public let nowhere: Bool
        public let role, workspace: JSONNull?

        public init(actor: ActorClass, can: [String], email: String, nowhere: Bool, role: JSONNull?, workspace: JSONNull?) {
            self.actor = actor
            self.can = can
            self.email = email
            self.nowhere = nowhere
            self.role = role
            self.workspace = workspace
        }
    }

    // MARK: - ActorClass
    public struct ActorClass: Codable, Sendable {
        public let avatarURL: String?
        public let id: String
        public let name: String

        public enum CodingKeys: String, CodingKey {
            case avatarURL = "avatar_url"
            case id, name
        }

        public init(avatarURL: String?, id: String, name: String) {
            self.avatarURL = avatarURL
            self.id = id
            self.name = name
        }
    }

    // MARK: - NowhereSession
    public struct NowhereSession: Codable, Sendable {
        public let accessToken: String
        public let actorID: String
        public let expiresIn: Int
        public let nowhere: Bool
        public let refreshToken: String
        public let workspaceID: JSONNull?

        public enum CodingKeys: String, CodingKey {
            case accessToken = "access_token"
            case actorID = "actor_id"
            case expiresIn = "expires_in"
            case nowhere
            case refreshToken = "refresh_token"
            case workspaceID = "workspace_id"
        }

        public init(accessToken: String, actorID: String, expiresIn: Int, nowhere: Bool, refreshToken: String, workspaceID: JSONNull?) {
            self.accessToken = accessToken
            self.actorID = actorID
            self.expiresIn = expiresIn
            self.nowhere = nowhere
            self.refreshToken = refreshToken
            self.workspaceID = workspaceID
        }
    }

    // MARK: - ObjectLink
    public struct ObjectLink: Codable, Sendable {
        public let createdAt: String
        public let createdBy: String
        public let deletedAt: String?
        public let fromID: String
        public let fromType: ObjectTypeEnum
        public let id, toID: String
        public let toType: ObjectTypeEnum
        public let updatedAt: String
        public let workspaceID: String

        public enum CodingKeys: String, CodingKey {
            case createdAt = "created_at"
            case createdBy = "created_by"
            case deletedAt = "deleted_at"
            case fromID = "from_id"
            case fromType = "from_type"
            case id
            case toID = "to_id"
            case toType = "to_type"
            case updatedAt = "updated_at"
            case workspaceID = "workspace_id"
        }

        public init(createdAt: String, createdBy: String, deletedAt: String?, fromID: String, fromType: ObjectTypeEnum, id: String, toID: String, toType: ObjectTypeEnum, updatedAt: String, workspaceID: String) {
            self.createdAt = createdAt
            self.createdBy = createdBy
            self.deletedAt = deletedAt
            self.fromID = fromID
            self.fromType = fromType
            self.id = id
            self.toID = toID
            self.toType = toType
            self.updatedAt = updatedAt
            self.workspaceID = workspaceID
        }
    }

    // MARK: - OpenOnPerson
    public struct OpenOnPerson: Codable, Sendable {
        public let color, dueOn, icon: String?
        public let id: String
        public let number: Int?
        public let overdue: Bool?
        public let projectID: String
        public let projectKey, projectName, projectSlug: String?
        public let title: String

        public enum CodingKeys: String, CodingKey {
            case color
            case dueOn = "due_on"
            case icon, id, number, overdue
            case projectID = "project_id"
            case projectKey = "project_key"
            case projectName = "project_name"
            case projectSlug = "project_slug"
            case title
        }

        public init(color: String?, dueOn: String?, icon: String?, id: String, number: Int?, overdue: Bool?, projectID: String, projectKey: String?, projectName: String?, projectSlug: String?, title: String) {
            self.color = color
            self.dueOn = dueOn
            self.icon = icon
            self.id = id
            self.number = number
            self.overdue = overdue
            self.projectID = projectID
            self.projectKey = projectKey
            self.projectName = projectName
            self.projectSlug = projectSlug
            self.title = title
        }
    }

    // MARK: - PasswordChanged
    public struct PasswordChanged: Codable, Sendable {
        public let ok: Bool
        public let signedOut: Int?

        public enum CodingKeys: String, CodingKey {
            case ok
            case signedOut = "signed_out"
        }

        public init(ok: Bool, signedOut: Int?) {
            self.ok = ok
            self.signedOut = signedOut
        }
    }

    // MARK: - PasswordSet
    public struct PasswordSet: Codable, Sendable {
        public let accessToken: String?
        public let actorID: String?
        public let expiresIn: Int?
        public let ok: Bool
        public let refreshToken: String?
        public let signedOut: Int?
        public let workspaceID: String?

        public enum CodingKeys: String, CodingKey {
            case accessToken = "access_token"
            case actorID = "actor_id"
            case expiresIn = "expires_in"
            case ok
            case refreshToken = "refresh_token"
            case signedOut = "signed_out"
            case workspaceID = "workspace_id"
        }

        public init(accessToken: String?, actorID: String?, expiresIn: Int?, ok: Bool, refreshToken: String?, signedOut: Int?, workspaceID: String?) {
            self.accessToken = accessToken
            self.actorID = actorID
            self.expiresIn = expiresIn
            self.ok = ok
            self.refreshToken = refreshToken
            self.signedOut = signedOut
            self.workspaceID = workspaceID
        }
    }

    // MARK: - PendingClass
    public struct PendingClass: Codable, Sendable {
        public let approve: Bool?
        public let email: String?
        public let pending: Bool

        public init(approve: Bool?, email: String?, pending: Bool) {
            self.approve = approve
            self.email = email
            self.pending = pending
        }
    }

    // MARK: - PeopleList
    public struct PeopleList: Codable, Sendable {
        public let people: [PersonInWorkspace]

        public init(people: [PersonInWorkspace]) {
            self.people = people
        }
    }

    // MARK: - PersonInWorkspace
    public struct PersonInWorkspace: Codable, Sendable {
        public let activeAt: String?
        public let actorID: String
        public let agent: Bool?
        public let avatarURL, connectedByName: String?
        public let connectsAgents, createsProjects, invitesPeople: Bool?
        public let joinedAt: String?
        public let mayConnectAgents, mayCreateChannels: Bool?
        public let mayCreateProjects, mayInvitePeople, maySeeMembers: Bool?
        public let name: String
        public let presence: Presence?
        public let role: String?
        public let seesMembers: Bool?
        public let status: AgentStatus?
        public let title: String?

        public enum CodingKeys: String, CodingKey {
            case activeAt = "active_at"
            case actorID = "actor_id"
            case agent
            case avatarURL = "avatar_url"
            case connectedByName = "connected_by_name"
            case connectsAgents = "connects_agents"
            case createsProjects = "creates_projects"
            case invitesPeople = "invites_people"
            case joinedAt = "joined_at"
            case mayConnectAgents = "may_connect_agents"
            case mayCreateChannels = "may_create_channels"
            case mayCreateProjects = "may_create_projects"
            case mayInvitePeople = "may_invite_people"
            case maySeeMembers = "may_see_members"
            case name, presence, role
            case seesMembers = "sees_members"
            case status, title
        }

        public init(activeAt: String?, actorID: String, agent: Bool?, avatarURL: String?, connectedByName: String?, connectsAgents: Bool?, createsProjects: Bool?, invitesPeople: Bool?, joinedAt: String?, mayConnectAgents: Bool?, mayCreateChannels: Bool?, mayCreateProjects: Bool?, mayInvitePeople: Bool?, maySeeMembers: Bool?, name: String, presence: Presence?, role: String?, seesMembers: Bool?, status: AgentStatus?, title: String?) {
            self.activeAt = activeAt
            self.actorID = actorID
            self.agent = agent
            self.avatarURL = avatarURL
            self.connectedByName = connectedByName
            self.connectsAgents = connectsAgents
            self.createsProjects = createsProjects
            self.invitesPeople = invitesPeople
            self.joinedAt = joinedAt
            self.mayConnectAgents = mayConnectAgents
            self.mayCreateChannels = mayCreateChannels
            self.mayCreateProjects = mayCreateProjects
            self.mayInvitePeople = mayInvitePeople
            self.maySeeMembers = maySeeMembers
            self.name = name
            self.presence = presence
            self.role = role
            self.seesMembers = seesMembers
            self.status = status
            self.title = title
        }
    }

    public enum Presence: String, Codable, Sendable {
        case away = "away"
        case busy = "busy"
        case here = "here"
    }

    // MARK: - PersonDay
    public struct PersonDay: Codable, Sendable {
        public let day: String
        public let n: Count

        public init(day: String, n: Count) {
            self.day = day
            self.n = n
        }
    }

    // MARK: - PersonHours
    public struct PersonHours: Codable, Sendable {
        public let minutes: Int
        public let number: Int?
        public let projectID: String
        public let projectName: String?
        public let taskID: String?
        public let title: String?

        public enum CodingKeys: String, CodingKey {
            case minutes, number
            case projectID = "project_id"
            case projectName = "project_name"
            case taskID = "task_id"
            case title
        }

        public init(minutes: Int, number: Int?, projectID: String, projectName: String?, taskID: String?, title: String?) {
            self.minutes = minutes
            self.number = number
            self.projectID = projectID
            self.projectName = projectName
            self.taskID = taskID
            self.title = title
        }
    }

    // MARK: - PersonInProject
    public struct PersonInProject: Codable, Sendable {
        public let activeAt: String?
        public let actorID: String
        public let agent: Bool?
        public let avatarURL, connectedByName: String?
        public let connectsAgents, createsProjects, invitesPeople: Bool?
        public let joinedAt: String?
        public let mayConnectAgents, mayCreateChannels: Bool?
        public let mayCreateProjects, mayInvitePeople, maySeeMembers: Bool?
        public let name: String
        public let presence: Presence?
        public let rights: [String]
        public let role: String?
        public let seesMembers: Bool?
        public let status: AgentStatus?
        public let title: String?

        public enum CodingKeys: String, CodingKey {
            case activeAt = "active_at"
            case actorID = "actor_id"
            case agent
            case avatarURL = "avatar_url"
            case connectedByName = "connected_by_name"
            case connectsAgents = "connects_agents"
            case createsProjects = "creates_projects"
            case invitesPeople = "invites_people"
            case joinedAt = "joined_at"
            case mayConnectAgents = "may_connect_agents"
            case mayCreateChannels = "may_create_channels"
            case mayCreateProjects = "may_create_projects"
            case mayInvitePeople = "may_invite_people"
            case maySeeMembers = "may_see_members"
            case name, presence, rights, role
            case seesMembers = "sees_members"
            case status, title
        }

        public init(activeAt: String?, actorID: String, agent: Bool?, avatarURL: String?, connectedByName: String?, connectsAgents: Bool?, createsProjects: Bool?, invitesPeople: Bool?, joinedAt: String?, mayConnectAgents: Bool?, mayCreateChannels: Bool?, mayCreateProjects: Bool?, mayInvitePeople: Bool?, maySeeMembers: Bool?, name: String, presence: Presence?, rights: [String], role: String?, seesMembers: Bool?, status: AgentStatus?, title: String?) {
            self.activeAt = activeAt
            self.actorID = actorID
            self.agent = agent
            self.avatarURL = avatarURL
            self.connectedByName = connectedByName
            self.connectsAgents = connectsAgents
            self.createsProjects = createsProjects
            self.invitesPeople = invitesPeople
            self.joinedAt = joinedAt
            self.mayConnectAgents = mayConnectAgents
            self.mayCreateChannels = mayCreateChannels
            self.mayCreateProjects = mayCreateProjects
            self.mayInvitePeople = mayInvitePeople
            self.maySeeMembers = maySeeMembers
            self.name = name
            self.presence = presence
            self.rights = rights
            self.role = role
            self.seesMembers = seesMembers
            self.status = status
            self.title = title
        }
    }

    // MARK: - PersonOnPage
    public struct PersonOnPage: Codable, Sendable {
        public let actorID: String
        public let avatarURL, email, joinedAt: String?
        public let name: String
        public let presence, role, timezone, title: String?

        public enum CodingKeys: String, CodingKey {
            case actorID = "actor_id"
            case avatarURL = "avatar_url"
            case email
            case joinedAt = "joined_at"
            case name, presence, role, timezone, title
        }

        public init(actorID: String, avatarURL: String?, email: String?, joinedAt: String?, name: String, presence: String?, role: String?, timezone: String?, title: String?) {
            self.actorID = actorID
            self.avatarURL = avatarURL
            self.email = email
            self.joinedAt = joinedAt
            self.name = name
            self.presence = presence
            self.role = role
            self.timezone = timezone
            self.title = title
        }
    }

    // MARK: - PersonPage
    public struct PersonPage: Codable, Sendable {
        public let days: [PersonDay]?
        public let hours: [PersonHours]?
        public let personPageOpen: [OpenOnPerson]?
        public let person: PersonOnPage
        public let projects: [Project]?
        public let shared: [SharedProject]?
        public let weeks: [PersonWeek]?

        public enum CodingKeys: String, CodingKey {
            case days, hours
            case personPageOpen = "open"
            case person, projects, shared, weeks
        }

        public init(days: [PersonDay]?, hours: [PersonHours]?, personPageOpen: [OpenOnPerson]?, person: PersonOnPage, projects: [Project]?, shared: [SharedProject]?, weeks: [PersonWeek]?) {
            self.days = days
            self.hours = hours
            self.personPageOpen = personPageOpen
            self.person = person
            self.projects = projects
            self.shared = shared
            self.weeks = weeks
        }
    }

    // MARK: - Project
    public struct Project: Codable, Sendable {
        public let id: String
        public let key: String?
        public let name: String
        public let slug: String?

        public init(id: String, key: String?, name: String, slug: String?) {
            self.id = id
            self.key = key
            self.name = name
            self.slug = slug
        }
    }

    // MARK: - SharedProject
    public struct SharedProject: Codable, Sendable {
        public let done: Count?
        public let id: String
        public let key: String?
        public let name: String
        public let sharedProjectOpen, overdue: Count?
        public let slug: String?

        public enum CodingKeys: String, CodingKey {
            case done, id, key, name
            case sharedProjectOpen = "open"
            case overdue, slug
        }

        public init(done: Count?, id: String, key: String?, name: String, sharedProjectOpen: Count?, overdue: Count?, slug: String?) {
            self.done = done
            self.id = id
            self.key = key
            self.name = name
            self.sharedProjectOpen = sharedProjectOpen
            self.overdue = overdue
            self.slug = slug
        }
    }

    // MARK: - PersonWeek
    public struct PersonWeek: Codable, Sendable {
        public let done, said: Count
        public let week: String

        public init(done: Count, said: Count, week: String) {
            self.done = done
            self.said = said
            self.week = week
        }
    }

    // MARK: - Post
    public struct Post: Codable, Sendable {
        public let authorID: String
        public let body: [String: JSONAny]
        public let category: String?
        public let createdAt: String
        public let deletedAt: String?
        public let id: String
        public let number: Int
        public let projectID: String
        public let publishedAt: String?
        public let schedule: String?
        public let title: String
        public let updatedAt: String
        public let workspaceID: String

        public enum CodingKeys: String, CodingKey {
            case authorID = "author_id"
            case body, category
            case createdAt = "created_at"
            case deletedAt = "deleted_at"
            case id, number
            case projectID = "project_id"
            case publishedAt = "published_at"
            case schedule, title
            case updatedAt = "updated_at"
            case workspaceID = "workspace_id"
        }

        public init(authorID: String, body: [String: JSONAny], category: String?, createdAt: String, deletedAt: String?, id: String, number: Int, projectID: String, publishedAt: String?, schedule: String?, title: String, updatedAt: String, workspaceID: String) {
            self.authorID = authorID
            self.body = body
            self.category = category
            self.createdAt = createdAt
            self.deletedAt = deletedAt
            self.id = id
            self.number = number
            self.projectID = projectID
            self.publishedAt = publishedAt
            self.schedule = schedule
            self.title = title
            self.updatedAt = updatedAt
            self.workspaceID = workspaceID
        }
    }

    // MARK: - PostInList
    public struct PostInList: Codable, Sendable {
        public let authorAvatarURL: String?
        public let authorID: String
        public let authorName: String
        public let body: [String: JSONAny]
        public let category: String?
        public let createdAt: String
        public let deletedAt: String?
        public let id: String
        public let number: Int
        public let projectID: String
        public let publishedAt: String?
        public let replyCount: Int
        public let schedule: String?
        public let title: String
        public let updatedAt: String?
        public let workspaceID: String?

        public enum CodingKeys: String, CodingKey {
            case authorAvatarURL = "author_avatar_url"
            case authorID = "author_id"
            case authorName = "author_name"
            case body, category
            case createdAt = "created_at"
            case deletedAt = "deleted_at"
            case id, number
            case projectID = "project_id"
            case publishedAt = "published_at"
            case replyCount = "reply_count"
            case schedule, title
            case updatedAt = "updated_at"
            case workspaceID = "workspace_id"
        }

        public init(authorAvatarURL: String?, authorID: String, authorName: String, body: [String: JSONAny], category: String?, createdAt: String, deletedAt: String?, id: String, number: Int, projectID: String, publishedAt: String?, replyCount: Int, schedule: String?, title: String, updatedAt: String?, workspaceID: String?) {
            self.authorAvatarURL = authorAvatarURL
            self.authorID = authorID
            self.authorName = authorName
            self.body = body
            self.category = category
            self.createdAt = createdAt
            self.deletedAt = deletedAt
            self.id = id
            self.number = number
            self.projectID = projectID
            self.publishedAt = publishedAt
            self.replyCount = replyCount
            self.schedule = schedule
            self.title = title
            self.updatedAt = updatedAt
            self.workspaceID = workspaceID
        }
    }

    // MARK: - PostInProject
    public struct PostInProject: Codable, Sendable {
        public let audience: String?
        public let authorAvatarURL: String?
        public let authorID: String?
        public let authorName: String?
        public let body: [String: JSONAny]?
        public let category: String?
        public let createdAt: String
        public let id: String
        public let number: Int?
        public let projectID: String?
        public let publishedAt: String?
        public let replyCount: Count?
        public let schedule: String?
        public let title: String
        public let updatedAt: String?

        public enum CodingKeys: String, CodingKey {
            case audience
            case authorAvatarURL = "author_avatar_url"
            case authorID = "author_id"
            case authorName = "author_name"
            case body, category
            case createdAt = "created_at"
            case id, number
            case projectID = "project_id"
            case publishedAt = "published_at"
            case replyCount = "reply_count"
            case schedule, title
            case updatedAt = "updated_at"
        }

        public init(audience: String?, authorAvatarURL: String?, authorID: String?, authorName: String?, body: [String: JSONAny]?, category: String?, createdAt: String, id: String, number: Int?, projectID: String?, publishedAt: String?, replyCount: Count?, schedule: String?, title: String, updatedAt: String?) {
            self.audience = audience
            self.authorAvatarURL = authorAvatarURL
            self.authorID = authorID
            self.authorName = authorName
            self.body = body
            self.category = category
            self.createdAt = createdAt
            self.id = id
            self.number = number
            self.projectID = projectID
            self.publishedAt = publishedAt
            self.replyCount = replyCount
            self.schedule = schedule
            self.title = title
            self.updatedAt = updatedAt
        }
    }

    // MARK: - PostPage
    public struct PostPage: Codable, Sendable {
        public let drafts: [PostInProject]?
        public let nextCursor: String?
        public let posts: [PostInProject]

        public enum CodingKeys: String, CodingKey {
            case drafts
            case nextCursor = "next_cursor"
            case posts
        }

        public init(drafts: [PostInProject]?, nextCursor: String?, posts: [PostInProject]) {
            self.drafts = drafts
            self.nextCursor = nextCursor
            self.posts = posts
        }
    }

    // MARK: - PostPublished
    public struct PostPublished: Codable, Sendable {
        public let audience: String
        public let ok: Bool
        public let publishedAt: String?

        public enum CodingKeys: String, CodingKey {
            case audience, ok
            case publishedAt = "published_at"
        }

        public init(audience: String, ok: Bool, publishedAt: String?) {
            self.audience = audience
            self.ok = ok
            self.publishedAt = publishedAt
        }
    }

    // MARK: - PostRead
    public struct PostRead: Codable, Sendable {
        public let comments: [CommentOnObject]?
        public let commentsEarlier: String?
        public let post: PostClass

        public enum CodingKeys: String, CodingKey {
            case comments
            case commentsEarlier = "comments_earlier"
            case post
        }

        public init(comments: [CommentOnObject]?, commentsEarlier: String?, post: PostClass) {
            self.comments = comments
            self.commentsEarlier = commentsEarlier
            self.post = post
        }
    }

    // MARK: - PostClass
    public struct PostClass: Codable, Sendable {
        public let audience: String?
        public let authorAgent: Bool?
        public let authorAvatarURL: String?
        public let authorID: String?
        public let authorName: String?
        public let body: [String: JSONAny]?
        public let category: String?
        public let createdAt: String
        public let id: String
        public let mayDelete, mayEdit: Bool?
        public let number: Int?
        public let projectID: String?
        public let publishedAt: String?
        public let replyCount: Count?
        public let schedule: String?
        public let subscribed: Bool?
        public let title: String
        public let updatedAt: String?

        public enum CodingKeys: String, CodingKey {
            case audience
            case authorAgent = "author_agent"
            case authorAvatarURL = "author_avatar_url"
            case authorID = "author_id"
            case authorName = "author_name"
            case body, category
            case createdAt = "created_at"
            case id
            case mayDelete = "may_delete"
            case mayEdit = "may_edit"
            case number
            case projectID = "project_id"
            case publishedAt = "published_at"
            case replyCount = "reply_count"
            case schedule, subscribed, title
            case updatedAt = "updated_at"
        }

        public init(audience: String?, authorAgent: Bool?, authorAvatarURL: String?, authorID: String?, authorName: String?, body: [String: JSONAny]?, category: String?, createdAt: String, id: String, mayDelete: Bool?, mayEdit: Bool?, number: Int?, projectID: String?, publishedAt: String?, replyCount: Count?, schedule: String?, subscribed: Bool?, title: String, updatedAt: String?) {
            self.audience = audience
            self.authorAgent = authorAgent
            self.authorAvatarURL = authorAvatarURL
            self.authorID = authorID
            self.authorName = authorName
            self.body = body
            self.category = category
            self.createdAt = createdAt
            self.id = id
            self.mayDelete = mayDelete
            self.mayEdit = mayEdit
            self.number = number
            self.projectID = projectID
            self.publishedAt = publishedAt
            self.replyCount = replyCount
            self.schedule = schedule
            self.subscribed = subscribed
            self.title = title
            self.updatedAt = updatedAt
        }
    }

    // MARK: - ProjectClass
    public struct ProjectClass: Codable, Sendable {
        public let archivedAt: String?
        public let createdAt: String
        public let deletedAt: String?
        public let description: String?
        public let id: String
        public let key: String
        public let name: String
        public let sample: Bool
        public let slug: String
        public let tools: [Tool]
        public let updatedAt: String
        public let workspaceID: String

        public enum CodingKeys: String, CodingKey {
            case archivedAt = "archived_at"
            case createdAt = "created_at"
            case deletedAt = "deleted_at"
            case description, id, key, name, sample, slug, tools
            case updatedAt = "updated_at"
            case workspaceID = "workspace_id"
        }

        public init(archivedAt: String?, createdAt: String, deletedAt: String?, description: String?, id: String, key: String, name: String, sample: Bool, slug: String, tools: [Tool], updatedAt: String, workspaceID: String) {
            self.archivedAt = archivedAt
            self.createdAt = createdAt
            self.deletedAt = deletedAt
            self.description = description
            self.id = id
            self.key = key
            self.name = name
            self.sample = sample
            self.slug = slug
            self.tools = tools
            self.updatedAt = updatedAt
            self.workspaceID = workspaceID
        }
    }

    public enum Tool: String, Codable, Sendable {
        case files = "files"
        case messages = "messages"
        case posts = "posts"
        case tasks = "tasks"
    }

    // MARK: - ProjectBin
    public struct ProjectBin: Codable, Sendable {
        public let projects: [ProjectInBin]

        public init(projects: [ProjectInBin]) {
            self.projects = projects
        }
    }

    // MARK: - ProjectInBin
    public struct ProjectInBin: Codable, Sendable {
        public let deletedAt: String
        public let description: String?
        public let id: String
        public let name: String

        public enum CodingKeys: String, CodingKey {
            case deletedAt = "deleted_at"
            case description, id, name
        }

        public init(deletedAt: String, description: String?, id: String, name: String) {
            self.deletedAt = deletedAt
            self.description = description
            self.id = id
            self.name = name
        }
    }

    // MARK: - ProjectGithub
    public struct ProjectGithub: Codable, Sendable {
        public let link: GithubLink?

        public init(link: GithubLink?) {
            self.link = link
        }
    }

    // MARK: - ProjectInList
    public struct ProjectInList: Codable, Sendable {
        public let archivedAt: String?
        public let can: [String]?
        public let createdAt: String?
        public let deletedAt: String?
        public let description: String?
        public let forAgents: ForAgents?
        public let iconURL: String?
        public let id: String
        public let key: String
        public let markIcon: String?
        public let markTint: Int?
        public let name: String
        public let sample: Bool
        public let slug: String
        public let tools: [Tool]
        public let updatedAt: String?
        public let workspaceID: String?

        public enum CodingKeys: String, CodingKey {
            case archivedAt = "archived_at"
            case can
            case createdAt = "created_at"
            case deletedAt = "deleted_at"
            case description
            case forAgents = "for_agents"
            case iconURL = "icon_url"
            case id, key
            case markIcon = "mark_icon"
            case markTint = "mark_tint"
            case name, sample, slug, tools
            case updatedAt = "updated_at"
            case workspaceID = "workspace_id"
        }

        public init(archivedAt: String?, can: [String]?, createdAt: String?, deletedAt: String?, description: String?, forAgents: ForAgents?, iconURL: String?, id: String, key: String, markIcon: String?, markTint: Int?, name: String, sample: Bool, slug: String, tools: [Tool], updatedAt: String?, workspaceID: String?) {
            self.archivedAt = archivedAt
            self.can = can
            self.createdAt = createdAt
            self.deletedAt = deletedAt
            self.description = description
            self.forAgents = forAgents
            self.iconURL = iconURL
            self.id = id
            self.key = key
            self.markIcon = markIcon
            self.markTint = markTint
            self.name = name
            self.sample = sample
            self.slug = slug
            self.tools = tools
            self.updatedAt = updatedAt
            self.workspaceID = workspaceID
        }
    }

    // MARK: - ForAgents
    public struct ForAgents: Codable, Sendable {
        public let id: String
        public let name: String
        public let number: Int?

        public init(id: String, name: String, number: Int?) {
            self.id = id
            self.name = name
            self.number = number
        }
    }

    // MARK: - ProjectMember
    public struct ProjectMember: Codable, Sendable {
        public let actorID: String
        public let addedBy: String?
        public let createdAt: String
        public let deletedAt: String?
        public let id, projectID: String
        public let updatedAt: String
        public let workspaceID: String

        public enum CodingKeys: String, CodingKey {
            case actorID = "actor_id"
            case addedBy = "added_by"
            case createdAt = "created_at"
            case deletedAt = "deleted_at"
            case id
            case projectID = "project_id"
            case updatedAt = "updated_at"
            case workspaceID = "workspace_id"
        }

        public init(actorID: String, addedBy: String?, createdAt: String, deletedAt: String?, id: String, projectID: String, updatedAt: String, workspaceID: String) {
            self.actorID = actorID
            self.addedBy = addedBy
            self.createdAt = createdAt
            self.deletedAt = deletedAt
            self.id = id
            self.projectID = projectID
            self.updatedAt = updatedAt
            self.workspaceID = workspaceID
        }
    }

    // MARK: - ProjectMembers
    public struct ProjectMembers: Codable, Sendable {
        public let members: [PersonInProject]

        public init(members: [PersonInProject]) {
            self.members = members
        }
    }

    // MARK: - ProjectPage
    public struct ProjectPage: Codable, Sendable {
        public let nextCursor: String?
        public let projects: [ProjectInList]

        public enum CodingKeys: String, CodingKey {
            case nextCursor = "next_cursor"
            case projects
        }

        public init(nextCursor: String?, projects: [ProjectInList]) {
            self.nextCursor = nextCursor
            self.projects = projects
        }
    }

    // MARK: - ProjectSlack
    public struct ProjectSlack: Codable, Sendable {
        public let link: SlackLink?

        public init(link: SlackLink?) {
            self.link = link
        }
    }

    // MARK: - SlackLink
    public struct SlackLink: Codable, Sendable {
        public let channelID, channelName, linkedByName: String
        public let slackLinkPrivate: Bool
        public let stopped, stoppedAt: String?

        public enum CodingKeys: String, CodingKey {
            case channelID = "channel_id"
            case channelName = "channel_name"
            case linkedByName = "linked_by_name"
            case slackLinkPrivate = "private"
            case stopped
            case stoppedAt = "stopped_at"
        }

        public init(channelID: String, channelName: String, linkedByName: String, slackLinkPrivate: Bool, stopped: String?, stoppedAt: String?) {
            self.channelID = channelID
            self.channelName = channelName
            self.linkedByName = linkedByName
            self.slackLinkPrivate = slackLinkPrivate
            self.stopped = stopped
            self.stoppedAt = stoppedAt
        }
    }

    // MARK: - Providers
    public struct Providers: Codable, Sendable {
        public let apple, github, google, mail: Bool
        public let noMail, oidc: Bool
        public let oidcName: String?
        public let signUp: Bool

        public enum CodingKeys: String, CodingKey {
            case apple, github, google, mail
            case noMail = "no_mail"
            case oidc
            case oidcName = "oidc_name"
            case signUp = "sign_up"
        }

        public init(apple: Bool, github: Bool, google: Bool, mail: Bool, noMail: Bool, oidc: Bool, oidcName: String?, signUp: Bool) {
            self.apple = apple
            self.github = github
            self.google = google
            self.mail = mail
            self.noMail = noMail
            self.oidc = oidc
            self.oidcName = oidcName
            self.signUp = signUp
        }
    }

    // MARK: - PublicDocument
    public struct PublicDocument: Codable, Sendable {
        public let body: [String: JSONAny]?
        public let brand: Brand?
        public let name: String
        public let pictures: [String: Picture]
        public let updatedAt: String

        public enum CodingKeys: String, CodingKey {
            case body, brand, name, pictures
            case updatedAt = "updated_at"
        }

        public init(body: [String: JSONAny]?, brand: Brand?, name: String, pictures: [String: Picture], updatedAt: String) {
            self.body = body
            self.brand = brand
            self.name = name
            self.pictures = pictures
            self.updatedAt = updatedAt
        }
    }

    // MARK: - Picture
    public struct Picture: Codable, Sendable {
        public let displayURL: String?
        public let url: String

        public enum CodingKeys: String, CodingKey {
            case displayURL = "display_url"
            case url
        }

        public init(displayURL: String?, url: String) {
            self.displayURL = displayURL
            self.url = url
        }
    }

    // MARK: - PublicShare
    public struct PublicShare: Codable, Sendable {
        public let token: String?

        public init(token: String?) {
            self.token = token
        }
    }

    // MARK: - PullOnTask
    public struct PullOnTask: Codable, Sendable {
        public let authorAvatar, authorLogin, checks: String?
        public let closes, draft: Bool
        public let headRef: String?
        public let number: Int
        public let repoName: String
        public let review: String?
        public let state, title, url: String

        public enum CodingKeys: String, CodingKey {
            case authorAvatar = "author_avatar"
            case authorLogin = "author_login"
            case checks, closes, draft
            case headRef = "head_ref"
            case number
            case repoName = "repo_name"
            case review, state, title, url
        }

        public init(authorAvatar: String?, authorLogin: String?, checks: String?, closes: Bool, draft: Bool, headRef: String?, number: Int, repoName: String, review: String?, state: String, title: String, url: String) {
            self.authorAvatar = authorAvatar
            self.authorLogin = authorLogin
            self.checks = checks
            self.closes = closes
            self.draft = draft
            self.headRef = headRef
            self.number = number
            self.repoName = repoName
            self.review = review
            self.state = state
            self.title = title
            self.url = url
        }
    }

    // MARK: - PushDevice
    public struct PushDevice: Codable, Sendable {
        public let createdAt: String
        public let id: String
        public let kind: String
        public let lastUsedAt, said: String?

        public enum CodingKeys: String, CodingKey {
            case createdAt = "created_at"
            case id, kind
            case lastUsedAt = "last_used_at"
            case said
        }

        public init(createdAt: String, id: String, kind: String, lastUsedAt: String?, said: String?) {
            self.createdAt = createdAt
            self.id = id
            self.kind = kind
            self.lastUsedAt = lastUsedAt
            self.said = said
        }
    }

    // MARK: - PushDevices
    public struct PushDevices: Codable, Sendable {
        public let apns: Bool
        public let devices: [PushDevice]
        public let fcm: Bool?
        public let key: String?

        public init(apns: Bool, devices: [PushDevice], fcm: Bool?, key: String?) {
            self.apns = apns
            self.devices = devices
            self.fcm = fcm
            self.key = key
        }
    }

    // MARK: - PushTried
    public struct PushTried: Codable, Sendable {
        public let devices: [PushTriedDevice]

        public init(devices: [PushTriedDevice]) {
            self.devices = devices
        }
    }

    // MARK: - PushTriedDevice
    public struct PushTriedDevice: Codable, Sendable {
        public let id: String
        public let kind: String
        public let reason, said: String?
        public let status: Int

        public init(id: String, kind: String, reason: String?, said: String?, status: Int) {
            self.id = id
            self.kind = kind
            self.reason = reason
            self.said = said
            self.status = status
        }
    }

    // MARK: - QuestionAnswer
    public struct QuestionAnswer: Codable, Sendable {
        public let answer: Int?
        public let answeredAt: String?
        public let answeredBy: String?
        public let answeredByName: String?
        public let choices: [QuestionChoice]
        public let id, objectID: String?
        public let ok: Bool?

        public enum CodingKeys: String, CodingKey {
            case answer
            case answeredAt = "answered_at"
            case answeredBy = "answered_by"
            case answeredByName = "answered_by_name"
            case choices, id
            case objectID = "object_id"
            case ok
        }

        public init(answer: Int?, answeredAt: String?, answeredBy: String?, answeredByName: String?, choices: [QuestionChoice], id: String?, objectID: String?, ok: Bool?) {
            self.answer = answer
            self.answeredAt = answeredAt
            self.answeredBy = answeredBy
            self.answeredByName = answeredByName
            self.choices = choices
            self.id = id
            self.objectID = objectID
            self.ok = ok
        }
    }

    // MARK: - RealtimeEvent
    public struct RealtimeEvent: Codable, Sendable {
        public let kind: String
        public let payload: Payload?
        public let topic: String

        public init(kind: String, payload: Payload?, topic: String) {
            self.kind = kind
            self.payload = payload
            self.topic = topic
        }
    }

    // MARK: - Payload
    public struct Payload: Codable, Sendable {
        public let actorID: String?
        public let conversationID, id: String?
        public let objectID, objectType: String?
        public let projectID: String?
        public let reason, tab: String?

        public enum CodingKeys: String, CodingKey {
            case actorID = "actor_id"
            case conversationID = "conversation_id"
            case id
            case objectID = "object_id"
            case objectType = "object_type"
            case projectID = "project_id"
            case reason, tab
        }

        public init(actorID: String?, conversationID: String?, id: String?, objectID: String?, objectType: String?, projectID: String?, reason: String?, tab: String?) {
            self.actorID = actorID
            self.conversationID = conversationID
            self.id = id
            self.objectID = objectID
            self.objectType = objectType
            self.projectID = projectID
            self.reason = reason
            self.tab = tab
        }
    }

    // MARK: - RecoveryCodes
    public struct RecoveryCodes: Codable, Sendable {
        public let recoveryCodes: [String]

        public enum CodingKeys: String, CodingKey {
            case recoveryCodes = "recovery_codes"
        }

        public init(recoveryCodes: [String]) {
            self.recoveryCodes = recoveryCodes
        }
    }

    // MARK: - Rewait
    public struct Rewait: Codable, Sendable {
        public let id: String
        public let waitingOn: [String]

        public enum CodingKeys: String, CodingKey {
            case id
            case waitingOn = "waiting_on"
        }

        public init(id: String, waitingOn: [String]) {
            self.id = id
            self.waitingOn = waitingOn
        }
    }

    // MARK: - RoomHook
    public struct RoomHook: Codable, Sendable {
        public let createdAt: String
        public let createdBy: String
        public let createdByName: String
        public let id: String
        public let lastUsedAt: String?
        public let name: String
        public let stoppedAt: String?
        public let turnedAt: String?

        public enum CodingKeys: String, CodingKey {
            case createdAt = "created_at"
            case createdBy = "created_by"
            case createdByName = "created_by_name"
            case id
            case lastUsedAt = "last_used_at"
            case name
            case stoppedAt = "stopped_at"
            case turnedAt = "turned_at"
        }

        public init(createdAt: String, createdBy: String, createdByName: String, id: String, lastUsedAt: String?, name: String, stoppedAt: String?, turnedAt: String?) {
            self.createdAt = createdAt
            self.createdBy = createdBy
            self.createdByName = createdByName
            self.id = id
            self.lastUsedAt = lastUsedAt
            self.name = name
            self.stoppedAt = stoppedAt
            self.turnedAt = turnedAt
        }
    }

    // MARK: - RoomHookAddress
    public struct RoomHookAddress: Codable, Sendable {
        public let id: String
        public let name, url: String

        public init(id: String, name: String, url: String) {
            self.id = id
            self.name = name
            self.url = url
        }
    }

    // MARK: - RoomHooks
    public struct RoomHooks: Codable, Sendable {
        public let hooks: [RoomHook]

        public init(hooks: [RoomHook]) {
            self.hooks = hooks
        }
    }

    // MARK: - RoomPeople
    public struct RoomPeople: Codable, Sendable {
        public let chosen: Bool?
        public let members: [RoomPerson]

        public init(chosen: Bool?, members: [RoomPerson]) {
            self.chosen = chosen
            self.members = members
        }
    }

    // MARK: - RoomPerson
    public struct RoomPerson: Codable, Sendable {
        public let actorID: String
        public let avatarURL: String?
        public let name: String
        public let presence, role, title: String?

        public enum CodingKeys: String, CodingKey {
            case actorID = "actor_id"
            case avatarURL = "avatar_url"
            case name, presence, role, title
        }

        public init(actorID: String, avatarURL: String?, name: String, presence: String?, role: String?, title: String?) {
            self.actorID = actorID
            self.avatarURL = avatarURL
            self.name = name
            self.presence = presence
            self.role = role
            self.title = title
        }
    }

    // MARK: - SavedTemplate
    public struct SavedTemplate: Codable, Sendable {
        public let id: String
        public let name: String
        public let projectID: String
        public let projectName, templateAt: String

        public enum CodingKeys: String, CodingKey {
            case id, name
            case projectID = "project_id"
            case projectName = "project_name"
            case templateAt = "template_at"
        }

        public init(id: String, name: String, projectID: String, projectName: String, templateAt: String) {
            self.id = id
            self.name = name
            self.projectID = projectID
            self.projectName = projectName
            self.templateAt = templateAt
        }
    }

    // MARK: - SavedTemplates
    public struct SavedTemplates: Codable, Sendable {
        public let templates: [SavedTemplate]

        public init(templates: [SavedTemplate]) {
            self.templates = templates
        }
    }

    // MARK: - SearchResult
    public struct SearchResult: Codable, Sendable {
        public let authorName: String?
        public let conversationID: String?
        public let createdAt: String?
        public let id: String
        public let markIcon: String?
        public let markTint, number: Int?
        public let parentID, projectID: String?
        public let snippet, title: String?
        public let type: String

        public enum CodingKeys: String, CodingKey {
            case authorName = "author_name"
            case conversationID = "conversation_id"
            case createdAt = "created_at"
            case id
            case markIcon = "mark_icon"
            case markTint = "mark_tint"
            case number
            case parentID = "parent_id"
            case projectID = "project_id"
            case snippet, title, type
        }

        public init(authorName: String?, conversationID: String?, createdAt: String?, id: String, markIcon: String?, markTint: Int?, number: Int?, parentID: String?, projectID: String?, snippet: String?, title: String?, type: String) {
            self.authorName = authorName
            self.conversationID = conversationID
            self.createdAt = createdAt
            self.id = id
            self.markIcon = markIcon
            self.markTint = markTint
            self.number = number
            self.parentID = parentID
            self.projectID = projectID
            self.snippet = snippet
            self.title = title
            self.type = type
        }
    }

    // MARK: - SearchResults
    public struct SearchResults: Codable, Sendable {
        public let results: [SearchResult]

        public init(results: [SearchResult]) {
            self.results = results
        }
    }

    // MARK: - SessionClass
    public struct SessionClass: Codable, Sendable {
        public let accessToken: String
        public let actorID: String
        public let expiresIn: Int
        public let refreshToken: String
        public let workspaceID: String

        public enum CodingKeys: String, CodingKey {
            case accessToken = "access_token"
            case actorID = "actor_id"
            case expiresIn = "expires_in"
            case refreshToken = "refresh_token"
            case workspaceID = "workspace_id"
        }

        public init(accessToken: String, actorID: String, expiresIn: Int, refreshToken: String, workspaceID: String) {
            self.accessToken = accessToken
            self.actorID = actorID
            self.expiresIn = expiresIn
            self.refreshToken = refreshToken
            self.workspaceID = workspaceID
        }
    }

    // MARK: - SessionRow
    public struct SessionRow: Codable, Sendable {
        public let createdAt: String
        public let current: Bool?
        public let expiresAt, host: String?
        public let id: String
        public let ip, lastUsedAt: String?
        public let sessions: Count?
        public let userAgent: String?

        public enum CodingKeys: String, CodingKey {
            case createdAt = "created_at"
            case current
            case expiresAt = "expires_at"
            case host, id, ip
            case lastUsedAt = "last_used_at"
            case sessions
            case userAgent = "user_agent"
        }

        public init(createdAt: String, current: Bool?, expiresAt: String?, host: String?, id: String, ip: String?, lastUsedAt: String?, sessions: Count?, userAgent: String?) {
            self.createdAt = createdAt
            self.current = current
            self.expiresAt = expiresAt
            self.host = host
            self.id = id
            self.ip = ip
            self.lastUsedAt = lastUsedAt
            self.sessions = sessions
            self.userAgent = userAgent
        }
    }

    // MARK: - Sessions
    public struct Sessions: Codable, Sendable {
        public let sessions: [SessionRow]

        public init(sessions: [SessionRow]) {
            self.sessions = sessions
        }
    }

    // MARK: - SetupMail
    public struct SetupMail: Codable, Sendable {
        public let mailSetup: MailSetup

        public enum CodingKeys: String, CodingKey {
            case mailSetup = "mail_setup"
        }

        public init(mailSetup: MailSetup) {
            self.mailSetup = mailSetup
        }
    }

    // MARK: - SetupState
    public struct SetupState: Codable, Sendable {
        public let mailSetup: MailSetup
        public let ownerEmail: String?

        public enum CodingKeys: String, CodingKey {
            case mailSetup = "mail_setup"
            case ownerEmail = "owner_email"
        }

        public init(mailSetup: MailSetup, ownerEmail: String?) {
            self.mailSetup = mailSetup
            self.ownerEmail = ownerEmail
        }
    }

    // MARK: - SignInCodeAsked
    public struct SignInCodeAsked: Codable, Sendable {
        public let sent: Bool

        public init(sent: Bool) {
            self.sent = sent
        }
    }

    // MARK: - SlackChannel
    public struct SlackChannel: Codable, Sendable {
        public let id, name: String
        public let slackChannelPrivate: Bool

        public enum CodingKeys: String, CodingKey {
            case id, name
            case slackChannelPrivate = "private"
        }

        public init(id: String, name: String, slackChannelPrivate: Bool) {
            self.id = id
            self.name = name
            self.slackChannelPrivate = slackChannelPrivate
        }
    }

    // MARK: - SlackChannels
    public struct SlackChannels: Codable, Sendable {
        public let channels: [SlackChannel]

        public init(channels: [SlackChannel]) {
            self.channels = channels
        }
    }

    // MARK: - SlackHello
    public struct SlackHello: Codable, Sendable {
        public let canConnect, configured: Bool
        public let connection: SlackHelloConnection?

        public enum CodingKeys: String, CodingKey {
            case canConnect = "can_connect"
            case configured, connection
        }

        public init(canConnect: Bool, configured: Bool, connection: SlackHelloConnection?) {
            self.canConnect = canConnect
            self.configured = configured
            self.connection = connection
        }
    }

    // MARK: - SlackHelloConnection
    public struct SlackHelloConnection: Codable, Sendable {
        public let broken, previews: Bool
        public let teamName: String

        public enum CodingKeys: String, CodingKey {
            case broken, previews
            case teamName = "team_name"
        }

        public init(broken: Bool, previews: Bool, teamName: String) {
            self.broken = broken
            self.previews = previews
            self.teamName = teamName
        }
    }

    // MARK: - SpendList
    public struct SpendList: Codable, Sendable {
        public let spend: [Spend]

        public init(spend: [Spend]) {
            self.spend = spend
        }
    }

    // MARK: - Spend
    public struct Spend: Codable, Sendable {
        public let actorID: String
        public let actorName: String?
        public let client: String
        public let costUsd: Double?
        public let projectID: String
        public let projectName: String?
        public let tokens: Double

        public enum CodingKeys: String, CodingKey {
            case actorID = "actor_id"
            case actorName = "actor_name"
            case client
            case costUsd = "cost_usd"
            case projectID = "project_id"
            case projectName = "project_name"
            case tokens
        }

        public init(actorID: String, actorName: String?, client: String, costUsd: Double?, projectID: String, projectName: String?, tokens: Double) {
            self.actorID = actorID
            self.actorName = actorName
            self.client = client
            self.costUsd = costUsd
            self.projectID = projectID
            self.projectName = projectName
            self.tokens = tokens
        }
    }

    // MARK: - SpendOnTask
    public struct SpendOnTask: Codable, Sendable {
        public let actorID: String
        public let actorName: String?
        public let client: String
        public let costUsd: Double?
        public let createdAt: String?
        public let id: String
        public let model: String?
        public let tokens: Double
        public let updatedAt: String?

        public enum CodingKeys: String, CodingKey {
            case actorID = "actor_id"
            case actorName = "actor_name"
            case client
            case costUsd = "cost_usd"
            case createdAt = "created_at"
            case id, model, tokens
            case updatedAt = "updated_at"
        }

        public init(actorID: String, actorName: String?, client: String, costUsd: Double?, createdAt: String?, id: String, model: String?, tokens: Double, updatedAt: String?) {
            self.actorID = actorID
            self.actorName = actorName
            self.client = client
            self.costUsd = costUsd
            self.createdAt = createdAt
            self.id = id
            self.model = model
            self.tokens = tokens
            self.updatedAt = updatedAt
        }
    }

    // MARK: - Step
    public struct Step: Codable, Sendable {
        public let assigneeID: String?
        public let assigneeIDS: [String]?
        public let color, doneAt, dueOn, icon: String?
        public let id: String
        public let sortKey: String?
        public let title: String

        public enum CodingKeys: String, CodingKey {
            case assigneeID = "assignee_id"
            case assigneeIDS = "assignee_ids"
            case color
            case doneAt = "done_at"
            case dueOn = "due_on"
            case icon, id
            case sortKey = "sort_key"
            case title
        }

        public init(assigneeID: String?, assigneeIDS: [String]?, color: String?, doneAt: String?, dueOn: String?, icon: String?, id: String, sortKey: String?, title: String) {
            self.assigneeID = assigneeID
            self.assigneeIDS = assigneeIDS
            self.color = color
            self.doneAt = doneAt
            self.dueOn = dueOn
            self.icon = icon
            self.id = id
            self.sortKey = sortKey
            self.title = title
        }
    }

    // MARK: - StepChanged
    public struct StepChanged: Codable, Sendable {
        public let ok: Bool
        public let rewaits: [Rewait]?
        public let task: TaskInProject?

        public init(ok: Bool, rewaits: [Rewait]?, task: TaskInProject?) {
            self.ok = ok
            self.rewaits = rewaits
            self.task = task
        }
    }

    // MARK: - TaskInProject
    public struct TaskInProject: Codable, Sendable {
        public let assigneeID: String?
        public let assigneeIDS: [String]?
        public let authorID: String?
        public let completedAt: String?
        public let createdAt: String?
        public let cycleID: String?
        public let decidedAt, dueOn, endsAt: String?
        public let id: String
        public let labels: [LabelOnTask]?
        public let listID: String?
        public let number: Int
        public let parentID: String?
        public let picture: TaskPicture?
        public let priority: String?
        public let taskInProjectRepeat: Repeat?
        public let sortKey, startsAt: String?
        public let title: String
        public let updatedAt: String?
        public let waitingOn: [String]?

        public enum CodingKeys: String, CodingKey {
            case assigneeID = "assignee_id"
            case assigneeIDS = "assignee_ids"
            case authorID = "author_id"
            case completedAt = "completed_at"
            case createdAt = "created_at"
            case cycleID = "cycle_id"
            case decidedAt = "decided_at"
            case dueOn = "due_on"
            case endsAt = "ends_at"
            case id, labels
            case listID = "list_id"
            case number
            case parentID = "parent_id"
            case picture, priority
            case taskInProjectRepeat = "repeat"
            case sortKey = "sort_key"
            case startsAt = "starts_at"
            case title
            case updatedAt = "updated_at"
            case waitingOn = "waiting_on"
        }

        public init(assigneeID: String?, assigneeIDS: [String]?, authorID: String?, completedAt: String?, createdAt: String?, cycleID: String?, decidedAt: String?, dueOn: String?, endsAt: String?, id: String, labels: [LabelOnTask]?, listID: String?, number: Int, parentID: String?, picture: TaskPicture?, priority: String?, taskInProjectRepeat: Repeat?, sortKey: String?, startsAt: String?, title: String, updatedAt: String?, waitingOn: [String]?) {
            self.assigneeID = assigneeID
            self.assigneeIDS = assigneeIDS
            self.authorID = authorID
            self.completedAt = completedAt
            self.createdAt = createdAt
            self.cycleID = cycleID
            self.decidedAt = decidedAt
            self.dueOn = dueOn
            self.endsAt = endsAt
            self.id = id
            self.labels = labels
            self.listID = listID
            self.number = number
            self.parentID = parentID
            self.picture = picture
            self.priority = priority
            self.taskInProjectRepeat = taskInProjectRepeat
            self.sortKey = sortKey
            self.startsAt = startsAt
            self.title = title
            self.updatedAt = updatedAt
            self.waitingOn = waitingOn
        }
    }

    // MARK: - TaskPicture
    public struct TaskPicture: Codable, Sendable {
        public let fileID: String
        public let height: Int?
        public let thumbURL: String
        public let width: Int?

        public enum CodingKeys: String, CodingKey {
            case fileID = "file_id"
            case height
            case thumbURL = "thumb_url"
            case width
        }

        public init(fileID: String, height: Int?, thumbURL: String, width: Int?) {
            self.fileID = fileID
            self.height = height
            self.thumbURL = thumbURL
            self.width = width
        }
    }

    // MARK: - StepMade
    public struct StepMade: Codable, Sendable {
        public let id: String
        public let task: TaskInProject?

        public init(id: String, task: TaskInProject?) {
            self.id = id
            self.task = task
        }
    }

    // MARK: - Subscription
    public struct Subscription: Codable, Sendable {
        public let actorID: String
        public let createdAt: String
        public let deletedAt: String?
        public let id, objectID: String
        public let objectType: ObjectType
        public let updatedAt: String
        public let workspaceID: String

        public enum CodingKeys: String, CodingKey {
            case actorID = "actor_id"
            case createdAt = "created_at"
            case deletedAt = "deleted_at"
            case id
            case objectID = "object_id"
            case objectType = "object_type"
            case updatedAt = "updated_at"
            case workspaceID = "workspace_id"
        }

        public init(actorID: String, createdAt: String, deletedAt: String?, id: String, objectID: String, objectType: ObjectType, updatedAt: String, workspaceID: String) {
            self.actorID = actorID
            self.createdAt = createdAt
            self.deletedAt = deletedAt
            self.id = id
            self.objectID = objectID
            self.objectType = objectType
            self.updatedAt = updatedAt
            self.workspaceID = workspaceID
        }
    }

    public enum ObjectType: String, Codable, Sendable {
        case conversation = "conversation"
        case file = "file"
        case post = "post"
        case task = "task"
    }

    // MARK: - Task
    public struct Task: Codable, Sendable {
        public let assigneeID: String?
        public let assigneeIDS: [String]
        public let authorID: String
        public let body: [String: JSONAny]?
        public let completedAt: String?
        public let createdAt, decidedAt: String
        public let deletedAt: String?
        public let dueOn: String?
        public let endsAt: String?
        public let id: String
        public let listID: String?
        public let number: Int
        public let parentID: String?
        public let priority: Priority?
        public let projectID: String
        public let taskRepeat: Repeat?
        public let repeatNextID: String?
        public let sortKey: String
        public let startsAt: String?
        public let title: String
        public let updatedAt: String
        public let workspaceID: String

        public enum CodingKeys: String, CodingKey {
            case assigneeID = "assignee_id"
            case assigneeIDS = "assignee_ids"
            case authorID = "author_id"
            case body
            case completedAt = "completed_at"
            case createdAt = "created_at"
            case decidedAt = "decided_at"
            case deletedAt = "deleted_at"
            case dueOn = "due_on"
            case endsAt = "ends_at"
            case id
            case listID = "list_id"
            case number
            case parentID = "parent_id"
            case priority
            case projectID = "project_id"
            case taskRepeat = "repeat"
            case repeatNextID = "repeat_next_id"
            case sortKey = "sort_key"
            case startsAt = "starts_at"
            case title
            case updatedAt = "updated_at"
            case workspaceID = "workspace_id"
        }

        public init(assigneeID: String?, assigneeIDS: [String], authorID: String, body: [String: JSONAny]?, completedAt: String?, createdAt: String, decidedAt: String, deletedAt: String?, dueOn: String?, endsAt: String?, id: String, listID: String?, number: Int, parentID: String?, priority: Priority?, projectID: String, taskRepeat: Repeat?, repeatNextID: String?, sortKey: String, startsAt: String?, title: String, updatedAt: String, workspaceID: String) {
            self.assigneeID = assigneeID
            self.assigneeIDS = assigneeIDS
            self.authorID = authorID
            self.body = body
            self.completedAt = completedAt
            self.createdAt = createdAt
            self.decidedAt = decidedAt
            self.deletedAt = deletedAt
            self.dueOn = dueOn
            self.endsAt = endsAt
            self.id = id
            self.listID = listID
            self.number = number
            self.parentID = parentID
            self.priority = priority
            self.projectID = projectID
            self.taskRepeat = taskRepeat
            self.repeatNextID = repeatNextID
            self.sortKey = sortKey
            self.startsAt = startsAt
            self.title = title
            self.updatedAt = updatedAt
            self.workspaceID = workspaceID
        }
    }

    public enum Priority: String, Codable, Sendable {
        case high = "high"
        case low = "low"
        case medium = "medium"
        case urgent = "urgent"
    }

    // MARK: - TaskCard
    public struct TaskCard: Codable, Sendable {
        public let card: TaskCardFace

        public init(card: TaskCardFace) {
            self.card = card
        }
    }

    // MARK: - TaskCardFace
    public struct TaskCardFace: Codable, Sendable {
        public let assigneeAvatarURL: String?
        public let assigneeID: String?
        public let assigneeName: String?
        public let assignees: [Assignee]
        public let completedAt: String?
        public let createdAt: String
        public let cycleName, decidedAt, dueOn: String?
        public let id: String
        public let labels: [Label]
        public let listColor, listIcon, listName: String?
        public let number: Double
        public let priority: String?
        public let projectID: String
        public let projectKey, projectName, projectSlug: String?
        public let taskCardFaceRepeat: Repeat?
        public let title: String

        public enum CodingKeys: String, CodingKey {
            case assigneeAvatarURL = "assignee_avatar_url"
            case assigneeID = "assignee_id"
            case assigneeName = "assignee_name"
            case assignees
            case completedAt = "completed_at"
            case createdAt = "created_at"
            case cycleName = "cycle_name"
            case decidedAt = "decided_at"
            case dueOn = "due_on"
            case id, labels
            case listColor = "list_color"
            case listIcon = "list_icon"
            case listName = "list_name"
            case number, priority
            case projectID = "project_id"
            case projectKey = "project_key"
            case projectName = "project_name"
            case projectSlug = "project_slug"
            case taskCardFaceRepeat = "repeat"
            case title
        }

        public init(assigneeAvatarURL: String?, assigneeID: String?, assigneeName: String?, assignees: [Assignee], completedAt: String?, createdAt: String, cycleName: String?, decidedAt: String?, dueOn: String?, id: String, labels: [Label], listColor: String?, listIcon: String?, listName: String?, number: Double, priority: String?, projectID: String, projectKey: String?, projectName: String?, projectSlug: String?, taskCardFaceRepeat: Repeat?, title: String) {
            self.assigneeAvatarURL = assigneeAvatarURL
            self.assigneeID = assigneeID
            self.assigneeName = assigneeName
            self.assignees = assignees
            self.completedAt = completedAt
            self.createdAt = createdAt
            self.cycleName = cycleName
            self.decidedAt = decidedAt
            self.dueOn = dueOn
            self.id = id
            self.labels = labels
            self.listColor = listColor
            self.listIcon = listIcon
            self.listName = listName
            self.number = number
            self.priority = priority
            self.projectID = projectID
            self.projectKey = projectKey
            self.projectName = projectName
            self.projectSlug = projectSlug
            self.taskCardFaceRepeat = taskCardFaceRepeat
            self.title = title
        }
    }

    // MARK: - Assignee
    public struct Assignee: Codable, Sendable {
        public let avatarURL: String?
        public let id: String
        public let name: String

        public enum CodingKeys: String, CodingKey {
            case avatarURL = "avatar_url"
            case id, name
        }

        public init(avatarURL: String?, id: String, name: String) {
            self.avatarURL = avatarURL
            self.id = id
            self.name = name
        }
    }

    // MARK: - Label
    public struct Label: Codable, Sendable {
        public let color: String?
        public let id: String
        public let name: String

        public init(color: String?, id: String, name: String) {
            self.color = color
            self.id = id
            self.name = name
        }
    }

    // MARK: - TaskChanged
    public struct TaskChanged: Codable, Sendable {
        public let next: TaskInProject?
        public let nextParts: [TaskInProject]?
        public let ok: Bool
        public let parts: [TaskInProject]?
        public let taskChangedRepeat: Repeat?
        public let rewaits: [Rewait]?
        public let sortKey: String?
        public let task: TaskInProject?
        public let withdrawn: String?

        public enum CodingKeys: String, CodingKey {
            case next
            case nextParts = "next_parts"
            case ok, parts
            case taskChangedRepeat = "repeat"
            case rewaits
            case sortKey = "sort_key"
            case task, withdrawn
        }

        public init(next: TaskInProject?, nextParts: [TaskInProject]?, ok: Bool, parts: [TaskInProject]?, taskChangedRepeat: Repeat?, rewaits: [Rewait]?, sortKey: String?, task: TaskInProject?, withdrawn: String?) {
            self.next = next
            self.nextParts = nextParts
            self.ok = ok
            self.parts = parts
            self.taskChangedRepeat = taskChangedRepeat
            self.rewaits = rewaits
            self.sortKey = sortKey
            self.task = task
            self.withdrawn = withdrawn
        }
    }

    // MARK: - TaskCopied
    public struct TaskCopied: Codable, Sendable {
        public let assigneesDropped: [AssigneesDropped]
        public let cycle: String?
        public let files: Int
        public let fromProjectID: String
        public let githubTo: Bool
        public let id: String?
        public let labelsDropped, labelsKept: [String]
        public let listID: String?
        public let listName: String?
        public let number: Int?
        public let projectID: String
        public let subtasks: Int
        public let tasks: [TaskInProject]?

        public enum CodingKeys: String, CodingKey {
            case assigneesDropped = "assignees_dropped"
            case cycle, files
            case fromProjectID = "from_project_id"
            case githubTo = "github_to"
            case id
            case labelsDropped = "labels_dropped"
            case labelsKept = "labels_kept"
            case listID = "list_id"
            case listName = "list_name"
            case number
            case projectID = "project_id"
            case subtasks, tasks
        }

        public init(assigneesDropped: [AssigneesDropped], cycle: String?, files: Int, fromProjectID: String, githubTo: Bool, id: String?, labelsDropped: [String], labelsKept: [String], listID: String?, listName: String?, number: Int?, projectID: String, subtasks: Int, tasks: [TaskInProject]?) {
            self.assigneesDropped = assigneesDropped
            self.cycle = cycle
            self.files = files
            self.fromProjectID = fromProjectID
            self.githubTo = githubTo
            self.id = id
            self.labelsDropped = labelsDropped
            self.labelsKept = labelsKept
            self.listID = listID
            self.listName = listName
            self.number = number
            self.projectID = projectID
            self.subtasks = subtasks
            self.tasks = tasks
        }
    }

    // MARK: - AssigneesDropped
    public struct AssigneesDropped: Codable, Sendable {
        public let actorID: String
        public let name: String

        public enum CodingKeys: String, CodingKey {
            case actorID = "actor_id"
            case name
        }

        public init(actorID: String, name: String) {
            self.actorID = actorID
            self.name = name
        }
    }

    // MARK: - TaskDeleted
    public struct TaskDeleted: Codable, Sendable {
        public let next: TaskInProject?
        public let nextParts: [TaskInProject]?
        public let ok: Bool

        public enum CodingKeys: String, CodingKey {
            case next
            case nextParts = "next_parts"
            case ok
        }

        public init(next: TaskInProject?, nextParts: [TaskInProject]?, ok: Bool) {
            self.next = next
            self.nextParts = nextParts
            self.ok = ok
        }
    }

    // MARK: - TaskDuplicated
    public struct TaskDuplicated: Codable, Sendable {
        public let id: String
        public let tasks: [TaskInProject]?

        public init(id: String, tasks: [TaskInProject]?) {
            self.id = id
            self.tasks = tasks
        }
    }

    // MARK: - TaskInDetail
    public struct TaskInDetail: Codable, Sendable {
        public let ancestors: [Ancestor]?
        public let assigneeID: String?
        public let assigneeIDS: [String]
        public let authorID: String
        public let authorName: String?
        public let blockedBy, blocks: [TaskRelated]?
        public let body: [String: JSONAny]?
        public let completedAt: String?
        public let createdAt: String?
        public let cycleID: String?
        public let decidedAt: String?
        public let deletedAt: String?
        public let dueOn: String?
        public let endsAt: String?
        public let id: String
        public let labels: [LabelOnTask]?
        public let listID: String?
        public let myReminder: TaskReminder?
        public let number: Int
        public let parentID: String?
        public let priority: String?
        public let projectID: String
        public let taskInDetailRepeat: Repeat?
        public let repeatNextID: String?
        public let sortKey: String
        public let startsAt: String?
        public let subscribed: Bool?
        public let title: String
        public let updatedAt: String?
        public let workspaceID: String?

        public enum CodingKeys: String, CodingKey {
            case ancestors
            case assigneeID = "assignee_id"
            case assigneeIDS = "assignee_ids"
            case authorID = "author_id"
            case authorName = "author_name"
            case blockedBy = "blocked_by"
            case blocks, body
            case completedAt = "completed_at"
            case createdAt = "created_at"
            case cycleID = "cycle_id"
            case decidedAt = "decided_at"
            case deletedAt = "deleted_at"
            case dueOn = "due_on"
            case endsAt = "ends_at"
            case id, labels
            case listID = "list_id"
            case myReminder = "my_reminder"
            case number
            case parentID = "parent_id"
            case priority
            case projectID = "project_id"
            case taskInDetailRepeat = "repeat"
            case repeatNextID = "repeat_next_id"
            case sortKey = "sort_key"
            case startsAt = "starts_at"
            case subscribed, title
            case updatedAt = "updated_at"
            case workspaceID = "workspace_id"
        }

        public init(ancestors: [Ancestor]?, assigneeID: String?, assigneeIDS: [String], authorID: String, authorName: String?, blockedBy: [TaskRelated]?, blocks: [TaskRelated]?, body: [String: JSONAny]?, completedAt: String?, createdAt: String?, cycleID: String?, decidedAt: String?, deletedAt: String?, dueOn: String?, endsAt: String?, id: String, labels: [LabelOnTask]?, listID: String?, myReminder: TaskReminder?, number: Int, parentID: String?, priority: String?, projectID: String, taskInDetailRepeat: Repeat?, repeatNextID: String?, sortKey: String, startsAt: String?, subscribed: Bool?, title: String, updatedAt: String?, workspaceID: String?) {
            self.ancestors = ancestors
            self.assigneeID = assigneeID
            self.assigneeIDS = assigneeIDS
            self.authorID = authorID
            self.authorName = authorName
            self.blockedBy = blockedBy
            self.blocks = blocks
            self.body = body
            self.completedAt = completedAt
            self.createdAt = createdAt
            self.cycleID = cycleID
            self.decidedAt = decidedAt
            self.deletedAt = deletedAt
            self.dueOn = dueOn
            self.endsAt = endsAt
            self.id = id
            self.labels = labels
            self.listID = listID
            self.myReminder = myReminder
            self.number = number
            self.parentID = parentID
            self.priority = priority
            self.projectID = projectID
            self.taskInDetailRepeat = taskInDetailRepeat
            self.repeatNextID = repeatNextID
            self.sortKey = sortKey
            self.startsAt = startsAt
            self.subscribed = subscribed
            self.title = title
            self.updatedAt = updatedAt
            self.workspaceID = workspaceID
        }
    }

    // MARK: - Ancestor
    public struct Ancestor: Codable, Sendable {
        public let id: String
        public let number: Int?
        public let title: String

        public init(id: String, number: Int?, title: String) {
            self.id = id
            self.number = number
            self.title = title
        }
    }

    // MARK: - TaskReminder
    public struct TaskReminder: Codable, Sendable {
        public let at: String

        public init(at: String) {
            self.at = at
        }
    }

    // MARK: - TaskInList
    public struct TaskInList: Codable, Sendable {
        public let assigneeID: String?
        public let assigneeIDS: [String]
        public let authorAvatarURL: String?
        public let authorID: String
        public let authorName: String?
        public let body: [String: JSONAny]?
        public let completedAt: String?
        public let createdAt: String?
        public let decidedAt: String
        public let deletedAt: String?
        public let dueOn: String?
        public let endsAt: String?
        public let id: String
        public let listID: String?
        public let number: Int
        public let parentID: String?
        public let priority: Priority?
        public let projectID: String
        public let taskInListRepeat: Repeat?
        public let repeatNextID: String?
        public let sortKey: String
        public let startsAt: String?
        public let title: String
        public let updatedAt: String?
        public let workspaceID: String?

        public enum CodingKeys: String, CodingKey {
            case assigneeID = "assignee_id"
            case assigneeIDS = "assignee_ids"
            case authorAvatarURL = "author_avatar_url"
            case authorID = "author_id"
            case authorName = "author_name"
            case body
            case completedAt = "completed_at"
            case createdAt = "created_at"
            case decidedAt = "decided_at"
            case deletedAt = "deleted_at"
            case dueOn = "due_on"
            case endsAt = "ends_at"
            case id
            case listID = "list_id"
            case number
            case parentID = "parent_id"
            case priority
            case projectID = "project_id"
            case taskInListRepeat = "repeat"
            case repeatNextID = "repeat_next_id"
            case sortKey = "sort_key"
            case startsAt = "starts_at"
            case title
            case updatedAt = "updated_at"
            case workspaceID = "workspace_id"
        }

        public init(assigneeID: String?, assigneeIDS: [String], authorAvatarURL: String?, authorID: String, authorName: String?, body: [String: JSONAny]?, completedAt: String?, createdAt: String?, decidedAt: String, deletedAt: String?, dueOn: String?, endsAt: String?, id: String, listID: String?, number: Int, parentID: String?, priority: Priority?, projectID: String, taskInListRepeat: Repeat?, repeatNextID: String?, sortKey: String, startsAt: String?, title: String, updatedAt: String?, workspaceID: String?) {
            self.assigneeID = assigneeID
            self.assigneeIDS = assigneeIDS
            self.authorAvatarURL = authorAvatarURL
            self.authorID = authorID
            self.authorName = authorName
            self.body = body
            self.completedAt = completedAt
            self.createdAt = createdAt
            self.decidedAt = decidedAt
            self.deletedAt = deletedAt
            self.dueOn = dueOn
            self.endsAt = endsAt
            self.id = id
            self.listID = listID
            self.number = number
            self.parentID = parentID
            self.priority = priority
            self.projectID = projectID
            self.taskInListRepeat = taskInListRepeat
            self.repeatNextID = repeatNextID
            self.sortKey = sortKey
            self.startsAt = startsAt
            self.title = title
            self.updatedAt = updatedAt
            self.workspaceID = workspaceID
        }
    }

    // MARK: - TaskList
    public struct TaskList: Codable, Sendable {
        public let agentID: String?
        public let authorID: String
        public let color: Color?
        public let createdAt: String
        public let deletedAt: String?
        public let finishes: Bool
        public let icon: Icon
        public let id: String
        public let intake: Bool?
        public let name: String
        public let narrow: Bool
        public let progress: Double?
        public let projectID: String
        public let sortKey: String
        public let updatedAt: String
        public let workspaceID: String

        public enum CodingKeys: String, CodingKey {
            case agentID = "agent_id"
            case authorID = "author_id"
            case color
            case createdAt = "created_at"
            case deletedAt = "deleted_at"
            case finishes, icon, id, intake, name, narrow, progress
            case projectID = "project_id"
            case sortKey = "sort_key"
            case updatedAt = "updated_at"
            case workspaceID = "workspace_id"
        }

        public init(agentID: String?, authorID: String, color: Color?, createdAt: String, deletedAt: String?, finishes: Bool, icon: Icon, id: String, intake: Bool?, name: String, narrow: Bool, progress: Double?, projectID: String, sortKey: String, updatedAt: String, workspaceID: String) {
            self.agentID = agentID
            self.authorID = authorID
            self.color = color
            self.createdAt = createdAt
            self.deletedAt = deletedAt
            self.finishes = finishes
            self.icon = icon
            self.id = id
            self.intake = intake
            self.name = name
            self.narrow = narrow
            self.progress = progress
            self.projectID = projectID
            self.sortKey = sortKey
            self.updatedAt = updatedAt
            self.workspaceID = workspaceID
        }
    }

    public enum Color: String, Codable, Sendable {
        case blue = "blue"
        case green = "green"
        case grey = "grey"
        case indigo = "indigo"
        case orange = "orange"
        case pink = "pink"
        case purple = "purple"
        case red = "red"
        case teal = "teal"
        case yellow = "yellow"
    }

    public enum Icon: String, Codable, Sendable {
        case backlog = "backlog"
        case doing = "doing"
        case done = "done"
        case iconOpen = "open"
        case review = "review"
        case started = "started"
        case stopped = "stopped"
    }

    // MARK: - TaskPage
    public struct TaskPage: Codable, Sendable {
        public let lists: [ListPage]?
        public let nextCursor: String?
        public let tasks: [TaskInProject]
        public let total: Int?

        public enum CodingKeys: String, CodingKey {
            case lists
            case nextCursor = "next_cursor"
            case tasks, total
        }

        public init(lists: [ListPage]?, nextCursor: String?, tasks: [TaskInProject], total: Int?) {
            self.lists = lists
            self.nextCursor = nextCursor
            self.tasks = tasks
            self.total = total
        }
    }

    // MARK: - TaskPrompt
    public struct TaskPrompt: Codable, Sendable {
        public let text: String

        public init(text: String) {
            self.text = text
        }
    }

    // MARK: - TaskRead
    public struct TaskRead: Codable, Sendable {
        public let comments: [CommentOnObject]?
        public let commentsEarlier: String?
        public let displays: [String: String]?
        public let feedback: Feedback?
        public let files: [String: String]?
        public let github: Github?
        public let sizes: [String: Double]?
        public let spend: [SpendOnTask]?
        public let steps: [Step]?
        public let task: TaskInDetail
        public let time: [TimeOnObject]?
        public let working: [AgentStatus]?

        public enum CodingKeys: String, CodingKey {
            case comments
            case commentsEarlier = "comments_earlier"
            case displays, feedback, files, github, sizes, spend, steps, task, time, working
        }

        public init(comments: [CommentOnObject]?, commentsEarlier: String?, displays: [String: String]?, feedback: Feedback?, files: [String: String]?, github: Github?, sizes: [String: Double]?, spend: [SpendOnTask]?, steps: [Step]?, task: TaskInDetail, time: [TimeOnObject]?, working: [AgentStatus]?) {
            self.comments = comments
            self.commentsEarlier = commentsEarlier
            self.displays = displays
            self.feedback = feedback
            self.files = files
            self.github = github
            self.sizes = sizes
            self.spend = spend
            self.steps = steps
            self.task = task
            self.time = time
            self.working = working
        }
    }

    // MARK: - Feedback
    public struct Feedback: Codable, Sendable {
        public let email: String?

        public init(email: String?) {
            self.email = email
        }
    }

    // MARK: - Github
    public struct Github: Codable, Sendable {
        public let issue: Issue?
        public let pulls: [PullOnTask]

        public init(issue: Issue?, pulls: [PullOnTask]) {
            self.issue = issue
            self.pulls = pulls
        }
    }

    // MARK: - Issue
    public struct Issue: Codable, Sendable {
        public let number: Int
        public let repoName, url: String

        public enum CodingKeys: String, CodingKey {
            case number
            case repoName = "repo_name"
            case url
        }

        public init(number: Int, repoName: String, url: String) {
            self.number = number
            self.repoName = repoName
            self.url = url
        }
    }

    // MARK: - TimeOnObject
    public struct TimeOnObject: Codable, Sendable {
        public let actorID: String
        public let actorName: String?
        public let id: String
        public let minutes: Int
        public let note: String?
        public let spentOn: String

        public enum CodingKeys: String, CodingKey {
            case actorID = "actor_id"
            case actorName = "actor_name"
            case id, minutes, note
            case spentOn = "spent_on"
        }

        public init(actorID: String, actorName: String?, id: String, minutes: Int, note: String?, spentOn: String) {
            self.actorID = actorID
            self.actorName = actorName
            self.id = id
            self.minutes = minutes
            self.note = note
            self.spentOn = spentOn
        }
    }

    // MARK: - TaskReminderSet
    public struct TaskReminderSet: Codable, Sendable {
        public let reminder: TaskReminder

        public init(reminder: TaskReminder) {
            self.reminder = reminder
        }
    }

    // MARK: - TasksImported
    public struct TasksImported: Codable, Sendable {
        public let written: Int

        public init(written: Int) {
            self.written = written
        }
    }

    // MARK: - TemplateChanged
    public struct TemplateChanged: Codable, Sendable {
        public let ok: Bool
        public let templateAt: String?

        public enum CodingKeys: String, CodingKey {
            case ok
            case templateAt = "template_at"
        }

        public init(ok: Bool, templateAt: String?) {
            self.ok = ok
            self.templateAt = templateAt
        }
    }

    // MARK: - TokenMade
    public struct TokenMade: Codable, Sendable {
        public let token: String

        public init(token: String) {
            self.token = token
        }
    }

    // MARK: - TokenRow
    public struct TokenRow: Codable, Sendable {
        public let createdAt: String
        public let expiresAt: String?
        public let id: String
        public let lastUsedAt: String?
        public let name: String
        public let projectIDS: [String]?
        public let revokedAt: String?

        public enum CodingKeys: String, CodingKey {
            case createdAt = "created_at"
            case expiresAt = "expires_at"
            case id
            case lastUsedAt = "last_used_at"
            case name
            case projectIDS = "project_ids"
            case revokedAt = "revoked_at"
        }

        public init(createdAt: String, expiresAt: String?, id: String, lastUsedAt: String?, name: String, projectIDS: [String]?, revokedAt: String?) {
            self.createdAt = createdAt
            self.expiresAt = expiresAt
            self.id = id
            self.lastUsedAt = lastUsedAt
            self.name = name
            self.projectIDS = projectIDS
            self.revokedAt = revokedAt
        }
    }

    // MARK: - Tokens
    public struct Tokens: Codable, Sendable {
        public let tokens: [TokenRow]

        public init(tokens: [TokenRow]) {
            self.tokens = tokens
        }
    }

    // MARK: - TwoFactor
    public struct TwoFactor: Codable, Sendable {
        public let enabled: Bool
        public let proof: Proof?
        public let recoveryLeft: Int?

        public enum CodingKeys: String, CodingKey {
            case enabled, proof
            case recoveryLeft = "recovery_left"
        }

        public init(enabled: Bool, proof: Proof?, recoveryLeft: Int?) {
            self.enabled = enabled
            self.proof = proof
            self.recoveryLeft = recoveryLeft
        }
    }

    public enum Proof: String, Codable, Sendable {
        case email = "email"
        case password = "password"
    }

    // MARK: - TwoFactorBegun
    public struct TwoFactorBegun: Codable, Sendable {
        public let secret, url: String

        public init(secret: String, url: String) {
            self.secret = secret
            self.url = url
        }
    }

    // MARK: - UnconfirmedAnswered
    public struct UnconfirmedAnswered: Codable, Sendable {
        public let accessToken: String?
        public let actorID: String?
        public let answer: Answer
        public let expiresIn: Int?
        public let ok: Bool
        public let refreshToken: String?
        public let workspaceID: String?

        public enum CodingKeys: String, CodingKey {
            case accessToken = "access_token"
            case actorID = "actor_id"
            case answer
            case expiresIn = "expires_in"
            case ok
            case refreshToken = "refresh_token"
            case workspaceID = "workspace_id"
        }

        public init(accessToken: String?, actorID: String?, answer: Answer, expiresIn: Int?, ok: Bool, refreshToken: String?, workspaceID: String?) {
            self.accessToken = accessToken
            self.actorID = actorID
            self.answer = answer
            self.expiresIn = expiresIn
            self.ok = ok
            self.refreshToken = refreshToken
            self.workspaceID = workspaceID
        }
    }

    public enum Answer: String, Codable, Sendable {
        case answerLeft = "left"
        case joined = "joined"
    }

    // MARK: - UnconfirmedWorkspaces
    public struct UnconfirmedWorkspaces: Codable, Sendable {
        public let waiting: [Waiting]

        public init(waiting: [Waiting]) {
            self.waiting = waiting
        }
    }

    // MARK: - Waiting
    public struct Waiting: Codable, Sendable {
        public let id: String
        public let name: String
        public let role: Role

        public init(id: String, name: String, role: Role) {
            self.id = id
            self.name = name
            self.role = role
        }
    }

    // MARK: - User
    public struct User: Codable, Sendable {
        public let actorID: String
        public let createdAt: String
        public let email: String
        public let emailVerifiedAt: String?
        public let totpEnabled: Bool
        public let updatedAt: String

        public enum CodingKeys: String, CodingKey {
            case actorID = "actor_id"
            case createdAt = "created_at"
            case email
            case emailVerifiedAt = "email_verified_at"
            case totpEnabled = "totp_enabled"
            case updatedAt = "updated_at"
        }

        public init(actorID: String, createdAt: String, email: String, emailVerifiedAt: String?, totpEnabled: Bool, updatedAt: String) {
            self.actorID = actorID
            self.createdAt = createdAt
            self.email = email
            self.emailVerifiedAt = emailVerifiedAt
            self.totpEnabled = totpEnabled
            self.updatedAt = updatedAt
        }
    }

    // MARK: - Verified
    public struct Verified: Codable, Sendable {
        public let accessToken: String?
        public let actorID: String?
        public let approved, changed: Bool?
        public let choosePassword: String?
        public let confirmed: Bool?
        public let email: String?
        public let expiresIn: Int?
        public let refreshToken: String?
        public let workspaceID: String?

        public enum CodingKeys: String, CodingKey {
            case accessToken = "access_token"
            case actorID = "actor_id"
            case approved, changed
            case choosePassword = "choose_password"
            case confirmed, email
            case expiresIn = "expires_in"
            case refreshToken = "refresh_token"
            case workspaceID = "workspace_id"
        }

        public init(accessToken: String?, actorID: String?, approved: Bool?, changed: Bool?, choosePassword: String?, confirmed: Bool?, email: String?, expiresIn: Int?, refreshToken: String?, workspaceID: String?) {
            self.accessToken = accessToken
            self.actorID = actorID
            self.approved = approved
            self.changed = changed
            self.choosePassword = choosePassword
            self.confirmed = confirmed
            self.email = email
            self.expiresIn = expiresIn
            self.refreshToken = refreshToken
            self.workspaceID = workspaceID
        }
    }

    // MARK: - WaitingInvitations
    public struct WaitingInvitations: Codable, Sendable {
        public let invitations: [Invitation]

        public init(invitations: [Invitation]) {
            self.invitations = invitations
        }
    }

    // MARK: - Invitation
    public struct Invitation: Codable, Sendable {
        public let host: String?
        public let id: String
        public let workspaceName: String

        public enum CodingKeys: String, CodingKey {
            case host, id
            case workspaceName = "workspace_name"
        }

        public init(host: String?, id: String, workspaceName: String) {
            self.host = host
            self.id = id
            self.workspaceName = workspaceName
        }
    }

    // MARK: - WayIn
    public struct WayIn: Codable, Sendable {
        public let createdAt: String
        public let email: String?
        public let id: String
        public let provider: Provider

        public enum CodingKeys: String, CodingKey {
            case createdAt = "created_at"
            case email, id, provider
        }

        public init(createdAt: String, email: String?, id: String, provider: Provider) {
            self.createdAt = createdAt
            self.email = email
            self.id = id
            self.provider = provider
        }
    }

    public enum Provider: String, Codable, Sendable {
        case apple = "apple"
        case github = "github"
        case google = "google"
        case oidc = "oidc"
    }

    // MARK: - WayInAdded
    public struct WayInAdded: Codable, Sendable {
        public let email: String?
        public let provider: Provider

        public init(email: String?, provider: Provider) {
            self.email = email
            self.provider = provider
        }
    }

    // MARK: - WayInStart
    public struct WayInStart: Codable, Sendable {
        public let url: String

        public init(url: String) {
            self.url = url
        }
    }

    // MARK: - WaysIn
    public struct WaysIn: Codable, Sendable {
        public let asks: AsksEnum
        public let offered: [Provider]
        public let oidcName: String?
        public let password: Bool
        public let ways: [WayIn]

        public enum CodingKeys: String, CodingKey {
            case asks, offered
            case oidcName = "oidc_name"
            case password, ways
        }

        public init(asks: AsksEnum, offered: [Provider], oidcName: String?, password: Bool, ways: [WayIn]) {
            self.asks = asks
            self.offered = offered
            self.oidcName = oidcName
            self.password = password
            self.ways = ways
        }
    }

    public enum AsksEnum: String, Codable, Sendable {
        case email = "email"
        case password = "password"
        case passwordAndCode = "password_and_code"
    }

    // MARK: - WebhookChanged
    public struct WebhookChanged: Codable, Sendable {
        public let ok: Bool
        public let secret: String?

        public init(ok: Bool, secret: String?) {
            self.ok = ok
            self.secret = secret
        }
    }

    // MARK: - WebhookMade
    public struct WebhookMade: Codable, Sendable {
        public let id: String
        public let secret: String

        public init(id: String, secret: String) {
            self.id = id
            self.secret = secret
        }
    }

    // MARK: - WebhookRow
    public struct WebhookRow: Codable, Sendable {
        public let authorizationSet: Bool?
        public let createdAt: String
        public let enabled: Bool
        public let events: [String]
        public let id: String
        public let lastAt: String?
        public let lastStatus: Int?
        public let stoppedAt: String?
        public let url: String

        public enum CodingKeys: String, CodingKey {
            case authorizationSet = "authorization_set"
            case createdAt = "created_at"
            case enabled, events, id
            case lastAt = "last_at"
            case lastStatus = "last_status"
            case stoppedAt = "stopped_at"
            case url
        }

        public init(authorizationSet: Bool?, createdAt: String, enabled: Bool, events: [String], id: String, lastAt: String?, lastStatus: Int?, stoppedAt: String?, url: String) {
            self.authorizationSet = authorizationSet
            self.createdAt = createdAt
            self.enabled = enabled
            self.events = events
            self.id = id
            self.lastAt = lastAt
            self.lastStatus = lastStatus
            self.stoppedAt = stoppedAt
            self.url = url
        }
    }

    // MARK: - Webhooks
    public struct Webhooks: Codable, Sendable {
        public let webhooks: [WebhookRow]

        public init(webhooks: [WebhookRow]) {
            self.webhooks = webhooks
        }
    }

    // MARK: - WorkspaceClass
    public struct WorkspaceClass: Codable, Sendable {
        public let createdAt: String
        public let deletedAt: String?
        public let id: String
        public let limits: [String: JSONAny]
        public let name: String
        public let plan: String
        public let settings: WorkspaceSettings
        public let slug: String
        public let updatedAt: String
        public let workspaceID: String

        public enum CodingKeys: String, CodingKey {
            case createdAt = "created_at"
            case deletedAt = "deleted_at"
            case id, limits, name, plan, settings, slug
            case updatedAt = "updated_at"
            case workspaceID = "workspace_id"
        }

        public init(createdAt: String, deletedAt: String?, id: String, limits: [String: JSONAny], name: String, plan: String, settings: WorkspaceSettings, slug: String, updatedAt: String, workspaceID: String) {
            self.createdAt = createdAt
            self.deletedAt = deletedAt
            self.id = id
            self.limits = limits
            self.name = name
            self.plan = plan
            self.settings = settings
            self.slug = slug
            self.updatedAt = updatedAt
            self.workspaceID = workspaceID
        }
    }

    // MARK: - WorkspaceSettings
    public struct WorkspaceSettings: Codable, Sendable {
        public let editOthersContent: EditOthersContent?
        public let whoCreatesProjects, whoInvitesPeople, whoSeesMembers: Who?

        public enum CodingKeys: String, CodingKey {
            case editOthersContent = "edit_others_content"
            case whoCreatesProjects = "who_creates_projects"
            case whoInvitesPeople = "who_invites_people"
            case whoSeesMembers = "who_sees_members"
        }

        public init(editOthersContent: EditOthersContent?, whoCreatesProjects: Who?, whoInvitesPeople: Who?, whoSeesMembers: Who?) {
            self.editOthersContent = editOthersContent
            self.whoCreatesProjects = whoCreatesProjects
            self.whoInvitesPeople = whoInvitesPeople
            self.whoSeesMembers = whoSeesMembers
        }
    }

    // MARK: - WorkspaceAddress
    public struct WorkspaceAddress: Codable, Sendable {
        public let free: Bool
        public let slug: String
        public let suggestion: String?

        public init(free: Bool, slug: String, suggestion: String?) {
            self.free = free
            self.slug = slug
            self.suggestion = suggestion
        }
    }

    // MARK: - WorkspaceErasing
    public struct WorkspaceErasing: Codable, Sendable {
        public let agents: Int
        public let asks, name: String
        public let paid: Bool
        public let people, projects: Int

        public init(agents: Int, asks: String, name: String, paid: Bool, people: Int, projects: Int) {
            self.agents = agents
            self.asks = asks
            self.name = name
            self.paid = paid
            self.people = people
            self.projects = projects
        }
    }

    // MARK: - WorkspaceImport
    public struct WorkspaceImport: Codable, Sendable {
        public let createdAt: String
        public let error, finishedAt: String?
        public let id: String
        public let progress: [String: ImportProgress]
        public let source: WorkspaceImportSource
        public let state: State
        public let teams: [ImportTeam]

        public enum CodingKeys: String, CodingKey {
            case createdAt = "created_at"
            case error
            case finishedAt = "finished_at"
            case id, progress, source, state, teams
        }

        public init(createdAt: String, error: String?, finishedAt: String?, id: String, progress: [String: ImportProgress], source: WorkspaceImportSource, state: State, teams: [ImportTeam]) {
            self.createdAt = createdAt
            self.error = error
            self.finishedAt = finishedAt
            self.id = id
            self.progress = progress
            self.source = source
            self.state = state
            self.teams = teams
        }
    }

    public enum WorkspaceImportSource: String, Codable, Sendable {
        case asana = "asana"
        case jira = "jira"
        case linear = "linear"
    }

    public enum State: String, Codable, Sendable {
        case done = "done"
        case failed = "failed"
        case running = "running"
    }

    // MARK: - WorkspaceImports
    public struct WorkspaceImports: Codable, Sendable {
        public let imports: [WorkspaceImport]

        public init(imports: [WorkspaceImport]) {
            self.imports = imports
        }
    }

    // MARK: - WorkspaceInList
    public struct WorkspaceInList: Codable, Sendable {
        public let iconURL: String?
        public let id: String
        public let markIcon: String?
        public let markTint: Int?
        public let name: String
        public let plan: String?
        public let role, slug: String
        public let unread: Bool?

        public enum CodingKeys: String, CodingKey {
            case iconURL = "icon_url"
            case id
            case markIcon = "mark_icon"
            case markTint = "mark_tint"
            case name, plan, role, slug, unread
        }

        public init(iconURL: String?, id: String, markIcon: String?, markTint: Int?, name: String, plan: String?, role: String, slug: String, unread: Bool?) {
            self.iconURL = iconURL
            self.id = id
            self.markIcon = markIcon
            self.markTint = markTint
            self.name = name
            self.plan = plan
            self.role = role
            self.slug = slug
            self.unread = unread
        }
    }

    // MARK: - WorkspaceList
    public struct WorkspaceList: Codable, Sendable {
        public let current: String?
        public let workspaces: [WorkspaceInList]

        public init(current: String?, workspaces: [WorkspaceInList]) {
            self.current = current
            self.workspaces = workspaces
        }
    }

    // MARK: - WorkspaceMade
    public struct WorkspaceMade: Codable, Sendable {
        public let accessToken: String
        public let actorID: String
        public let expiresIn: Int
        public let refreshToken, slug: String
        public let workspaceID: String

        public enum CodingKeys: String, CodingKey {
            case accessToken = "access_token"
            case actorID = "actor_id"
            case expiresIn = "expires_in"
            case refreshToken = "refresh_token"
            case slug
            case workspaceID = "workspace_id"
        }

        public init(accessToken: String, actorID: String, expiresIn: Int, refreshToken: String, slug: String, workspaceID: String) {
            self.accessToken = accessToken
            self.actorID = actorID
            self.expiresIn = expiresIn
            self.refreshToken = refreshToken
            self.slug = slug
            self.workspaceID = workspaceID
        }
    }

    // MARK: - Encode/decode helpers

    public final class JSONNull: Codable, Hashable, Sendable {

        public static func == (lhs: JSONNull, rhs: JSONNull) -> Bool {
            return true
        }

        public var hashValue: Int {
            return 0
        }

        public func hash(into hasher: inout Hasher) {
            // No-op
        }

        public init() {}

        public required init(from decoder: Decoder) throws {
            let container = try decoder.singleValueContainer()
            if !container.decodeNil() {
                throw DecodingError.typeMismatch(JSONNull.self, DecodingError.Context(codingPath: decoder.codingPath, debugDescription: "Wrong type for JSONNull"))
            }
        }

        public func encode(to encoder: Encoder) throws {
            var container = encoder.singleValueContainer()
            try container.encodeNil()
        }
    }

    final class JSONCodingKey: CodingKey, Sendable {
        let key: String

        required init?(intValue: Int) {
            return nil
        }

        required init?(stringValue: String) {
            key = stringValue
        }

        var intValue: Int? {
            return nil
        }

        var stringValue: String {
            return key
        }
    }

    public final class JSONAny: Codable, @unchecked Sendable {

        public let value: Any

        static func decodingError(forCodingPath codingPath: [CodingKey]) -> DecodingError {
            let context = DecodingError.Context(codingPath: codingPath, debugDescription: "Cannot decode JSONAny")
            return DecodingError.typeMismatch(JSONAny.self, context)
        }

        static func encodingError(forValue value: Any, codingPath: [CodingKey]) -> EncodingError {
            let context = EncodingError.Context(codingPath: codingPath, debugDescription: "Cannot encode JSONAny")
            return EncodingError.invalidValue(value, context)
        }

        static func decode(from container: SingleValueDecodingContainer) throws -> Any {
            if let value = try? container.decode(Bool.self) {
                return value
            }
            if let value = try? container.decode(Int64.self) {
                return value
            }
            if let value = try? container.decode(Double.self) {
                return value
            }
            if let value = try? container.decode(String.self) {
                return value
            }
            if container.decodeNil() {
                return JSONNull()
            }
            throw decodingError(forCodingPath: container.codingPath)
        }

        static func decode(from container: inout UnkeyedDecodingContainer) throws -> Any {
            if let value = try? container.decode(Bool.self) {
                return value
            }
            if let value = try? container.decode(Int64.self) {
                return value
            }
            if let value = try? container.decode(Double.self) {
                return value
            }
            if let value = try? container.decode(String.self) {
                return value
            }
            if let value = try? container.decodeNil() {
                if value {
                    return JSONNull()
                }
            }
            if var container = try? container.nestedUnkeyedContainer() {
                return try decodeArray(from: &container)
            }
            if var container = try? container.nestedContainer(keyedBy: JSONCodingKey.self) {
                return try decodeDictionary(from: &container)
            }
            throw decodingError(forCodingPath: container.codingPath)
        }

        static func decode(from container: inout KeyedDecodingContainer<JSONCodingKey>, forKey key: JSONCodingKey) throws -> Any {
            if let value = try? container.decode(Bool.self, forKey: key) {
                return value
            }
            if let value = try? container.decode(Int64.self, forKey: key) {
                return value
            }
            if let value = try? container.decode(Double.self, forKey: key) {
                return value
            }
            if let value = try? container.decode(String.self, forKey: key) {
                return value
            }
            if let value = try? container.decodeNil(forKey: key) {
                if value {
                    return JSONNull()
                }
            }
            if var container = try? container.nestedUnkeyedContainer(forKey: key) {
                return try decodeArray(from: &container)
            }
            if var container = try? container.nestedContainer(keyedBy: JSONCodingKey.self, forKey: key) {
                return try decodeDictionary(from: &container)
            }
            throw decodingError(forCodingPath: container.codingPath)
        }

        static func decodeArray(from container: inout UnkeyedDecodingContainer) throws -> [Any] {
            var arr: [Any] = []
            while !container.isAtEnd {
                let value = try decode(from: &container)
                arr.append(value)
            }
            return arr
        }

        static func decodeDictionary(from container: inout KeyedDecodingContainer<JSONCodingKey>) throws -> [String: Any] {
            var dict = [String: Any]()
            for key in container.allKeys {
                let value = try decode(from: &container, forKey: key)
                dict[key.stringValue] = value
            }
            return dict
        }

        static func encode(to container: inout UnkeyedEncodingContainer, array: [Any]) throws {
            for value in array {
                if let value = value as? Bool {
                    try container.encode(value)
                } else if let value = value as? Int64 {
                    try container.encode(value)
                } else if let value = value as? Double {
                    try container.encode(value)
                } else if let value = value as? String {
                    try container.encode(value)
                } else if value is JSONNull {
                    try container.encodeNil()
                } else if let value = value as? [Any] {
                    var container = container.nestedUnkeyedContainer()
                    try encode(to: &container, array: value)
                } else if let value = value as? [String: Any] {
                    var container = container.nestedContainer(keyedBy: JSONCodingKey.self)
                    try encode(to: &container, dictionary: value)
                } else {
                    throw encodingError(forValue: value, codingPath: container.codingPath)
                }
            }
        }

        static func encode(to container: inout KeyedEncodingContainer<JSONCodingKey>, dictionary: [String: Any]) throws {
            for (key, value) in dictionary {
                let key = JSONCodingKey(stringValue: key)!
                if let value = value as? Bool {
                    try container.encode(value, forKey: key)
                } else if let value = value as? Int64 {
                    try container.encode(value, forKey: key)
                } else if let value = value as? Double {
                    try container.encode(value, forKey: key)
                } else if let value = value as? String {
                    try container.encode(value, forKey: key)
                } else if value is JSONNull {
                    try container.encodeNil(forKey: key)
                } else if let value = value as? [Any] {
                    var container = container.nestedUnkeyedContainer(forKey: key)
                    try encode(to: &container, array: value)
                } else if let value = value as? [String: Any] {
                    var container = container.nestedContainer(keyedBy: JSONCodingKey.self, forKey: key)
                    try encode(to: &container, dictionary: value)
                } else {
                    throw encodingError(forValue: value, codingPath: container.codingPath)
                }
            }
        }

        static func encode(to container: inout SingleValueEncodingContainer, value: Any) throws {
            if let value = value as? Bool {
                try container.encode(value)
            } else if let value = value as? Int64 {
                try container.encode(value)
            } else if let value = value as? Double {
                try container.encode(value)
            } else if let value = value as? String {
                try container.encode(value)
            } else if value is JSONNull {
                try container.encodeNil()
            } else {
                throw encodingError(forValue: value, codingPath: container.codingPath)
            }
        }

        public required init(from decoder: Decoder) throws {
            if var arrayContainer = try? decoder.unkeyedContainer() {
                self.value = try JSONAny.decodeArray(from: &arrayContainer)
            } else if var container = try? decoder.container(keyedBy: JSONCodingKey.self) {
                self.value = try JSONAny.decodeDictionary(from: &container)
            } else {
                let container = try decoder.singleValueContainer()
                self.value = try JSONAny.decode(from: container)
            }
        }

        public func encode(to encoder: Encoder) throws {
            if let arr = self.value as? [Any] {
                var container = encoder.unkeyedContainer()
                try JSONAny.encode(to: &container, array: arr)
            } else if let dict = self.value as? [String: Any] {
                var container = encoder.container(keyedBy: JSONCodingKey.self)
                try JSONAny.encode(to: &container, dictionary: dict)
            } else {
                var container = encoder.singleValueContainer()
                try JSONAny.encode(to: &container, value: self.value)
            }
        }
    }
}
