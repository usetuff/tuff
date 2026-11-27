// Generated from shared-schema. Do not edit by hand.
// Source: docs/api.md, API version 1.
// Regenerate with: pnpm generate (kotlin)

@file:UseSerializers(LocalDateSerializer::class)

package com.usetuff.api

import java.time.LocalDate

import kotlinx.serialization.*
import kotlinx.serialization.json.*
import kotlinx.serialization.descriptors.*
import kotlinx.serialization.encoding.*

@Serializable
data class Contract (
    @SerialName("ActivityEvent")
    val activityEvent: ActivityEvent? = null,

    @SerialName("ActivityLine")
    val activityLine: ActivityLine? = null,

    @SerialName("ActivityPage")
    val activityPage: ActivityPage? = null,

    @SerialName("Actor")
    val actor: Actor? = null,

    @SerialName("AddressLink")
    val addressLink: AddressLink? = null,

    @SerialName("AddressLinkAccount")
    val addressLinkAccount: AddressLinkAccount? = null,

    @SerialName("AddressLinkKind")
    val addressLinkKind: AddressLinkKind? = null,

    @SerialName("AgentFacePick")
    val agentFacePick: AgentFacePick? = null,

    @SerialName("AgentInRoom")
    val agentInRoom: AgentInRoom? = null,

    @SerialName("AgentInRoomList")
    val agentInRoomList: AgentInRoomList? = null,

    @SerialName("AgentList")
    val agentList: AgentList? = null,

    @SerialName("AgentMade")
    val agentMade: AgentMade? = null,

    @SerialName("AgentReachChanged")
    val agentReachChanged: AgentReachChanged? = null,

    @SerialName("AgentRow")
    val agentRow: AgentRow? = null,

    @SerialName("AgentStatus")
    val agentStatus: AgentStatus? = null,

    @SerialName("AgentStatusList")
    val agentStatusList: AgentStatusList? = null,

    @SerialName("AgentStatusSet")
    val agentStatusSet: AgentStatusSet? = null,

    @SerialName("AgentTokenMade")
    val agentTokenMade: AgentTokenMade? = null,

    @SerialName("AgentWork")
    val agentWork: AgentWork? = null,

    @SerialName("AgentWorkTask")
    val agentWorkTask: AgentWorkTask? = null,

    @SerialName("AgentWorkTasks")
    val agentWorkTasks: AgentWorkTasks? = null,

    @SerialName("ApiError")
    val apiError: APIError? = null,

    @SerialName("ApiToken")
    val apiToken: APIToken? = null,

    @SerialName("AtNumber")
    val atNumber: AtNumber? = null,

    @SerialName("AudienceChanged")
    val audienceChanged: AudienceChanged? = null,

    @SerialName("AuditEvent")
    val auditEvent: AuditEvent? = null,

    @SerialName("AuditPage")
    val auditPage: AuditPage? = null,

    @SerialName("AuditPeople")
    val auditPeople: AuditPeople? = null,

    @SerialName("BlockerAdded")
    val blockerAdded: BlockerAdded? = null,

    @SerialName("Brand")
    val brand: Brand? = null,

    @SerialName("Comment")
    val comment: Comment? = null,

    @SerialName("CommentOnObject")
    val commentOnObject: CommentOnObject? = null,

    @SerialName("CommentsPage")
    val commentsPage: CommentsPage? = null,

    @SerialName("Conversation")
    val conversation: Conversation? = null,

    @SerialName("ConversationInList")
    val conversationInList: ConversationInList? = null,

    @SerialName("ConversationList")
    val conversationList: ConversationList? = null,

    @SerialName("Count")
    val count: Count? = null,

    @SerialName("CountOrNone")
    val countOrNone: CountOrNone? = null,

    @SerialName("Created")
    val created: Created? = null,

    @SerialName("CycleInProject")
    val cycleInProject: CycleInProject? = null,

    @SerialName("CyclesInProject")
    val cyclesInProject: CyclesInProject? = null,

    @SerialName("DeletedFile")
    val deletedFile: DeletedFile? = null,

    @SerialName("DeletedFilesPage")
    val deletedFilesPage: DeletedFilesPage? = null,

    @SerialName("DeletionPlan")
    val deletionPlan: DeletionPlan? = null,

    @SerialName("DirectMade")
    val directMade: DirectMade? = null,

    @SerialName("DocVersion")
    val docVersion: DocVersion? = null,

    @SerialName("DocVersionPage")
    val docVersionPage: DocVersionPage? = null,

    @SerialName("DocVersionRead")
    val docVersionRead: DocVersionRead? = null,

    @SerialName("DocVersionRestored")
    val docVersionRestored: DocVersionRestored? = null,

    @SerialName("FeedbackPublic")
    val feedbackPublic: FeedbackPublic? = null,

    @SerialName("FeedbackSettings")
    val feedbackSettings: FeedbackSettings? = null,

    @SerialName("File")
    val file: File? = null,

    @SerialName("FileChanged")
    val fileChanged: FileChanged? = null,

    @SerialName("FileImported")
    val fileImported: FileImported? = null,

    @SerialName("FileInDetail")
    val fileInDetail: FileInDetail? = null,

    @SerialName("FileInList")
    val fileInList: FileInList? = null,

    @SerialName("FileLink")
    val fileLink: FileLink? = null,

    @SerialName("FileRead")
    val fileRead: FileRead? = null,

    @SerialName("FilesInProject")
    val filesInProject: FilesInProject? = null,

    @SerialName("ForAgentsChanged")
    val forAgentsChanged: ForAgentsChanged? = null,

    @SerialName("GifKey")
    val gifKey: GIFKey? = null,

    @SerialName("GithubHello")
    val githubHello: GithubHello? = null,

    @SerialName("GithubLink")
    val githubLink: GithubLink? = null,

    @SerialName("GithubRepo")
    val githubRepo: GithubRepo? = null,

    @SerialName("GithubRepos")
    val githubRepos: GithubRepos? = null,

    @SerialName("HoursByPerson")
    val hoursByPerson: HoursByPerson? = null,

    @SerialName("HoursList")
    val hoursList: HoursList? = null,

    @SerialName("ImportProgress")
    val importProgress: ImportProgress? = null,

    @SerialName("ImportTeam")
    val importTeam: ImportTeam? = null,

    @SerialName("ImportTeams")
    val importTeams: ImportTeams? = null,

    @SerialName("Inbox")
    val inbox: Inbox? = null,

    @SerialName("InboxCodeSent")
    val inboxCodeSent: InboxCodeSent? = null,

    @SerialName("InboxSettings")
    val inboxSettings: InboxSettings? = null,

    @SerialName("Instance")
    val instance: Instance? = null,

    @SerialName("InstanceLetter")
    val instanceLetter: InstanceLetter? = null,

    @SerialName("InstanceOwner")
    val instanceOwner: InstanceOwner? = null,

    @SerialName("Invite")
    val invite: Invite? = null,

    @SerialName("InviteForMe")
    val inviteForMe: InviteForMe? = null,

    @SerialName("InviteList")
    val inviteList: InviteList? = null,

    @SerialName("InviteMade")
    val inviteMade: InviteMade? = null,

    @SerialName("InvitePreview")
    val invitePreview: InvitePreview? = null,

    @SerialName("InviteRow")
    val inviteRow: InviteRow? = null,

    @SerialName("LabelInProject")
    val labelInProject: LabelInProject? = null,

    @SerialName("LabelOnTask")
    val labelOnTask: LabelOnTask? = null,

    @SerialName("LabelsInProject")
    val labelsInProject: LabelsInProject? = null,

    @SerialName("LeftWorkspace")
    val leftWorkspace: LeftWorkspace? = null,

    @SerialName("LinkBack")
    val linkBack: LinkBack? = null,

    @SerialName("LinkPreview")
    val linkPreview: LinkPreview? = null,

    @SerialName("LinksBack")
    val linksBack: LinksBack? = null,

    @SerialName("ListInProject")
    val listInProject: ListInProject? = null,

    @SerialName("ListPage")
    val listPage: ListPage? = null,

    @SerialName("ListsInProject")
    val listsInProject: ListsInProject? = null,

    @SerialName("MailSetup")
    val mailSetup: MailSetup? = null,

    @SerialName("Me")
    val me: Me? = null,

    @SerialName("MeActor")
    val meActor: MeActor? = null,

    @SerialName("MeEmail")
    val meEmail: MeEmail? = null,

    @SerialName("Membership")
    val membership: Membership? = null,

    @SerialName("Message")
    val message: Message? = null,

    @SerialName("MessageInRoom")
    val messageInRoom: MessageInRoom? = null,

    @SerialName("MessagePage")
    val messagePage: MessagePage? = null,

    @SerialName("MessagesImported")
    val messagesImported: MessagesImported? = null,

    @SerialName("MeWorkspace")
    val meWorkspace: MeWorkspace? = null,

    @SerialName("MyTask")
    val myTask: MyTask? = null,

    @SerialName("MyTaskList")
    val myTaskList: MyTaskList? = null,

    @SerialName("Nameable")
    val nameable: Nameable? = null,

    @SerialName("Nameables")
    val nameables: Nameables? = null,

    @SerialName("Notification")
    val notification: Notification? = null,

    @SerialName("NotificationInInbox")
    val notificationInInbox: NotificationInInbox? = null,

    @SerialName("NowhereMe")
    val nowhereMe: NowhereMe? = null,

    @SerialName("NowhereSession")
    val nowhereSession: NowhereSession? = null,

    @SerialName("ObjectLink")
    val objectLink: ObjectLink? = null,

    @SerialName("OpenOnPerson")
    val openOnPerson: OpenOnPerson? = null,

    @SerialName("PasswordChanged")
    val passwordChanged: PasswordChanged? = null,

    @SerialName("PasswordSet")
    val passwordSet: PasswordSet? = null,

    @SerialName("Pending")
    val pending: PendingClass? = null,

    @SerialName("PeopleList")
    val peopleList: PeopleList? = null,

    @SerialName("PersonDay")
    val personDay: PersonDay? = null,

    @SerialName("PersonHours")
    val personHours: PersonHours? = null,

    @SerialName("PersonInProject")
    val personInProject: PersonInProject? = null,

    @SerialName("PersonInWorkspace")
    val personInWorkspace: PersonInWorkspace? = null,

    @SerialName("PersonOnPage")
    val personOnPage: PersonOnPage? = null,

    @SerialName("PersonPage")
    val personPage: PersonPage? = null,

    @SerialName("PersonWeek")
    val personWeek: PersonWeek? = null,

    @SerialName("Post")
    val post: Post? = null,

    @SerialName("PostInList")
    val postInList: PostInList? = null,

    @SerialName("PostInProject")
    val postInProject: PostInProject? = null,

    @SerialName("PostPage")
    val postPage: PostPage? = null,

    @SerialName("PostPublished")
    val postPublished: PostPublished? = null,

    @SerialName("PostRead")
    val postRead: PostRead? = null,

    @SerialName("Project")
    val project: ProjectClass? = null,

    @SerialName("ProjectBin")
    val projectBin: ProjectBin? = null,

    @SerialName("ProjectGithub")
    val projectGithub: ProjectGithub? = null,

    @SerialName("ProjectInBin")
    val projectInBin: ProjectInBin? = null,

    @SerialName("ProjectInList")
    val projectInList: ProjectInList? = null,

    @SerialName("ProjectMember")
    val projectMember: ProjectMember? = null,

    @SerialName("ProjectMembers")
    val projectMembers: ProjectMembers? = null,

    @SerialName("ProjectPage")
    val projectPage: ProjectPage? = null,

    @SerialName("ProjectSlack")
    val projectSlack: ProjectSlack? = null,

    @SerialName("Providers")
    val providers: Providers? = null,

    @SerialName("PublicDocument")
    val publicDocument: PublicDocument? = null,

    @SerialName("PublicShare")
    val publicShare: PublicShare? = null,

    @SerialName("PullOnTask")
    val pullOnTask: PullOnTask? = null,

    @SerialName("PushDevice")
    val pushDevice: PushDevice? = null,

    @SerialName("PushDevices")
    val pushDevices: PushDevices? = null,

    @SerialName("PushTried")
    val pushTried: PushTried? = null,

    @SerialName("PushTriedDevice")
    val pushTriedDevice: PushTriedDevice? = null,

    @SerialName("QuestionAnswer")
    val questionAnswer: QuestionAnswer? = null,

    @SerialName("QuestionChoice")
    val questionChoice: QuestionChoice? = null,

    @SerialName("QuestionInInbox")
    val questionInInbox: QuestionInInbox? = null,

    @SerialName("RealtimeEvent")
    val realtimeEvent: RealtimeEvent? = null,

    @SerialName("RecoveryCodes")
    val recoveryCodes: RecoveryCodes? = null,

    @SerialName("RemovedFrom")
    val removedFrom: RemovedFrom? = null,

    @SerialName("Repeat")
    val repeat: Repeat? = null,

    @SerialName("Rewait")
    val rewait: Rewait? = null,

    @SerialName("RoomHook")
    val roomHook: RoomHook? = null,

    @SerialName("RoomHookAddress")
    val roomHookAddress: RoomHookAddress? = null,

    @SerialName("RoomHooks")
    val roomHooks: RoomHooks? = null,

    @SerialName("RoomPeople")
    val roomPeople: RoomPeople? = null,

    @SerialName("RoomPerson")
    val roomPerson: RoomPerson? = null,

    @SerialName("SavedTemplate")
    val savedTemplate: SavedTemplate? = null,

    @SerialName("SavedTemplates")
    val savedTemplates: SavedTemplates? = null,

    @SerialName("SearchResult")
    val searchResult: SearchResult? = null,

    @SerialName("SearchResults")
    val searchResults: SearchResults? = null,

    @SerialName("ServerRelease")
    val serverRelease: ServerRelease? = null,

    @SerialName("ServerUpdate")
    val serverUpdate: ServerUpdate? = null,

    @SerialName("ServerVersion")
    val serverVersion: ServerVersion? = null,

    @SerialName("Session")
    val session: SessionClass? = null,

    @SerialName("SessionRow")
    val sessionRow: SessionRow? = null,

    @SerialName("Sessions")
    val sessions: Sessions? = null,

    @SerialName("SetupMail")
    val setupMail: SetupMail? = null,

    @SerialName("SetupState")
    val setupState: SetupState? = null,

    @SerialName("SharedProject")
    val sharedProject: SharedProject? = null,

    @SerialName("SignInCodeAsked")
    val signInCodeAsked: SignInCodeAsked? = null,

    @SerialName("SlackChannel")
    val slackChannel: SlackChannel? = null,

    @SerialName("SlackChannels")
    val slackChannels: SlackChannels? = null,

    @SerialName("SlackHello")
    val slackHello: SlackHello? = null,

    @SerialName("SlackLink")
    val slackLink: SlackLink? = null,

    @SerialName("SpendList")
    val spendList: SpendList? = null,

    @SerialName("SpendOnTask")
    val spendOnTask: SpendOnTask? = null,

    @SerialName("Step")
    val step: Step? = null,

    @SerialName("StepChanged")
    val stepChanged: StepChanged? = null,

    @SerialName("StepMade")
    val stepMade: StepMade? = null,

    @SerialName("Subscription")
    val subscription: Subscription? = null,

    @SerialName("Task")
    val task: Task? = null,

    @SerialName("TaskCard")
    val taskCard: TaskCard? = null,

    @SerialName("TaskCardFace")
    val taskCardFace: TaskCardFace? = null,

    @SerialName("TaskChanged")
    val taskChanged: TaskChanged? = null,

    @SerialName("TaskCopied")
    val taskCopied: TaskCopied? = null,

    @SerialName("TaskDeleted")
    val taskDeleted: TaskDeleted? = null,

    @SerialName("TaskDuplicated")
    val taskDuplicated: TaskDuplicated? = null,

    @SerialName("TaskInDetail")
    val taskInDetail: TaskInDetail? = null,

    @SerialName("TaskInList")
    val taskInList: TaskInList? = null,

    @SerialName("TaskInProject")
    val taskInProject: TaskInProject? = null,

    @SerialName("TaskList")
    val taskList: TaskList? = null,

    @SerialName("TaskPage")
    val taskPage: TaskPage? = null,

    @SerialName("TaskPicture")
    val taskPicture: TaskPicture? = null,

    @SerialName("TaskPrompt")
    val taskPrompt: TaskPrompt? = null,

    @SerialName("TaskRead")
    val taskRead: TaskRead? = null,

    @SerialName("TaskRelated")
    val taskRelated: TaskRelated? = null,

    @SerialName("TaskReminder")
    val taskReminder: TaskReminder? = null,

    @SerialName("TaskReminderSet")
    val taskReminderSet: TaskReminderSet? = null,

    @SerialName("TasksImported")
    val tasksImported: TasksImported? = null,

    @SerialName("TemplateChanged")
    val templateChanged: TemplateChanged? = null,

    @SerialName("TimeOnObject")
    val timeOnObject: TimeOnObject? = null,

    @SerialName("TokenMade")
    val tokenMade: TokenMade? = null,

    @SerialName("TokenRow")
    val tokenRow: TokenRow? = null,

    @SerialName("Tokens")
    val tokens: Tokens? = null,

    @SerialName("TwoFactor")
    val twoFactor: TwoFactor? = null,

    @SerialName("TwoFactorBegun")
    val twoFactorBegun: TwoFactorBegun? = null,

    @SerialName("UnconfirmedAnswered")
    val unconfirmedAnswered: UnconfirmedAnswered? = null,

    @SerialName("UnconfirmedWorkspaces")
    val unconfirmedWorkspaces: UnconfirmedWorkspaces? = null,

    @SerialName("User")
    val user: User? = null,

    @SerialName("Verified")
    val verified: Verified? = null,

    @SerialName("VersionContributor")
    val versionContributor: VersionContributor? = null,

    @SerialName("WaitingInvitations")
    val waitingInvitations: WaitingInvitations? = null,

    @SerialName("WayIn")
    val wayIn: WayIn? = null,

    @SerialName("WayInAdded")
    val wayInAdded: WayInAdded? = null,

    @SerialName("WayInStart")
    val wayInStart: WayInStart? = null,

    @SerialName("WaysIn")
    val waysIn: WaysIn? = null,

    @SerialName("WebhookChanged")
    val webhookChanged: WebhookChanged? = null,

    @SerialName("WebhookMade")
    val webhookMade: WebhookMade? = null,

    @SerialName("WebhookRow")
    val webhookRow: WebhookRow? = null,

    @SerialName("Webhooks")
    val webhooks: Webhooks? = null,

    @SerialName("Workspace")
    val workspace: WorkspaceClass? = null,

    @SerialName("WorkspaceAddress")
    val workspaceAddress: WorkspaceAddress? = null,

    @SerialName("WorkspaceErasing")
    val workspaceErasing: WorkspaceErasing? = null,

    @SerialName("WorkspaceImport")
    val workspaceImport: WorkspaceImport? = null,

    @SerialName("WorkspaceImports")
    val workspaceImports: WorkspaceImports? = null,

    @SerialName("WorkspaceInList")
    val workspaceInList: WorkspaceInList? = null,

    @SerialName("WorkspaceList")
    val workspaceList: WorkspaceList? = null,

    @SerialName("WorkspaceMade")
    val workspaceMade: WorkspaceMade? = null,

    @SerialName("WorkspaceSettings")
    val workspaceSettings: WorkspaceSettings? = null
)

@Serializable
data class ActivityEvent (
    val action: String,

    @SerialName("actor_id")
    val actorID: String,

    val at: String,
    val id: String,
    val meta: JsonObject,

    @SerialName("object_id")
    val objectID: String? = null,

    @SerialName("object_type")
    val objectType: String? = null,

    val origin: Origin,

    @SerialName("project_id")
    val projectID: String? = null,

    @SerialName("workspace_id")
    val workspaceID: String
)

@Serializable
enum class Origin(val value: String) {
    @SerialName("android") Android("android"),
    @SerialName("github") Github("github"),
    @SerialName("import") Import("import"),
    @SerialName("ios") Ios("ios"),
    @SerialName("mcp") MCP("mcp"),
    @SerialName("macos") Macos("macos"),
    @SerialName("system") OriginSystem("system"),
    @SerialName("web") Web("web");
}

@Serializable
data class ActivityLine (
    val action: String,

    @SerialName("actor_avatar_url")
    val actorAvatarURL: String? = null,

    @SerialName("actor_id")
    val actorID: String? = null,

    @SerialName("actor_name")
    val actorName: String? = null,

    val at: String,
    val id: String,
    val meta: JsonElement? = null,

    @SerialName("object_id")
    val objectID: String? = null,

    @SerialName("object_number")
    val objectNumber: CountOrNone? = null,

    @SerialName("object_title")
    val objectTitle: String? = null,

    @SerialName("object_type")
    val objectType: String? = null,

    val origin: String? = null,

    @SerialName("project_id")
    val projectID: String? = null,

    @SerialName("project_key")
    val projectKey: String? = null,

    @SerialName("project_name")
    val projectName: String? = null,

    @SerialName("project_slug")
    val projectSlug: String? = null
)

@Serializable
data class ActivityPage (
    val events: List<ActivityLine>,

    @SerialName("next_cursor")
    val nextCursor: String? = null
)

@Serializable
data class Actor (
    @SerialName("avatar_url")
    val avatarURL: String? = null,

    @SerialName("created_at")
    val createdAt: String,

    @SerialName("deleted_at")
    val deletedAt: String? = null,

    val id: String,
    val name: String,
    val title: String? = null,

    @SerialName("updated_at")
    val updatedAt: String
)

@Serializable
data class AddressLink (
    val account: AddressLinkAccount,
    val email: String,
    val kind: AddressLinkKind,

    @SerialName("needs_session")
    val needsSession: Boolean
)

@Serializable
data class AddressLinkAccount (
    val email: String,
    val id: String,
    val name: String
)

@Serializable
enum class AddressLinkKind(val value: String) {
    @SerialName("approve") Approve("approve"),
    @SerialName("email") Email("email");
}

@Serializable
data class AgentFacePick (
    val preset: Preset
)

@Serializable
enum class Preset(val value: String) {
    @SerialName("blob-1") Blob1("blob-1"),
    @SerialName("blob-2") Blob2("blob-2"),
    @SerialName("blob-3") Blob3("blob-3"),
    @SerialName("blob-4") Blob4("blob-4"),
    @SerialName("bot-1") Bot1("bot-1"),
    @SerialName("bot-10") Bot10("bot-10"),
    @SerialName("bot-2") Bot2("bot-2"),
    @SerialName("bot-3") Bot3("bot-3"),
    @SerialName("bot-4") Bot4("bot-4"),
    @SerialName("bot-5") Bot5("bot-5"),
    @SerialName("bot-6") Bot6("bot-6"),
    @SerialName("bot-7") Bot7("bot-7"),
    @SerialName("bot-8") Bot8("bot-8"),
    @SerialName("bot-9") Bot9("bot-9"),
    @SerialName("geo-1") Geo1("geo-1"),
    @SerialName("geo-2") Geo2("geo-2"),
    @SerialName("geo-3") Geo3("geo-3"),
    @SerialName("geo-4") Geo4("geo-4");
}

@Serializable
data class AgentInRoom (
    @SerialName("agent_id")
    val agentID: String,

    val doing: String? = null,

    @SerialName("message_id")
    val messageID: String? = null,

    val name: String,

    @SerialName("thread_id")
    val threadID: String? = null,

    val until: String
)

@Serializable
data class AgentInRoomList (
    val working: List<AgentInRoom>
)

@Serializable
data class AgentList (
    val agents: List<AgentRow>
)

@Serializable
data class AgentRow (
    @SerialName("active_at")
    val activeAt: String? = null,

    @SerialName("actor_id")
    val actorID: String,

    @SerialName("authorization_set")
    val authorizationSet: Boolean? = null,

    @SerialName("avatar_url")
    val avatarURL: String? = null,

    @SerialName("can_disconnect")
    val canDisconnect: Boolean,

    @SerialName("can_manage")
    val canManage: Boolean,

    val connections: List<ConnectionElement>? = null,

    @SerialName("created_at")
    val createdAt: String,

    @SerialName("created_by")
    val createdBy: String,

    @SerialName("created_by_name")
    val createdByName: String,

    val name: String,

    @SerialName("offered_project_ids")
    val offeredProjectIDS: List<String>,

    @SerialName("project_ids")
    val projectIDS: List<String>,

    val reach: String,
    val status: AgentStatus? = null,
    val stopped: Boolean? = null,

    @SerialName("webhook_shape")
    val webhookShape: String? = null,

    @SerialName("webhook_stopped")
    val webhookStopped: Boolean? = null,

    @SerialName("webhook_url")
    val webhookURL: String? = null
)

@Serializable
data class ConnectionElement (
    val client: String,

    @SerialName("created_at")
    val createdAt: String,

    val id: String,

    @SerialName("linked_by_name")
    val linkedByName: String
)

@Serializable
data class AgentStatus (
    @SerialName("agent_id")
    val agentID: String,

    val at: String,

    @SerialName("conversation_id")
    val conversationID: String? = null,

    val doing: String,

    @SerialName("project_id")
    val projectID: String? = null,

    val since: String,

    @SerialName("task_id")
    val taskID: String? = null,

    @SerialName("task_number")
    val taskNumber: Long? = null,

    @SerialName("thread_id")
    val threadID: String? = null,

    val until: String
)

@Serializable
data class AgentMade (
    @SerialName("agent_id")
    val agentID: String,

    val secret: String? = null,
    val token: String
)

@Serializable
data class AgentReachChanged (
    @SerialName("authorization_cleared")
    val authorizationCleared: Boolean,

    val ok: Boolean,
    val secret: String? = null
)

@Serializable
data class AgentStatusList (
    val working: List<AgentStatus>
)

@Serializable
data class AgentStatusSet (
    val status: AgentStatus? = null
)

@Serializable
data class AgentTokenMade (
    val token: String
)

@Serializable
data class AgentWork (
    val answered: Count,
    val asked: Count,

    @SerialName("cost_usd")
    val costUsd: Double? = null,

    val events: List<ActivityLine>,
    val finished: Count,
    val open: Count,
    val period: Period,
    val since: String,

    @SerialName("spent_on")
    val spentOn: Count,

    val tokens: Double,
    val took: Count
)

@Serializable
enum class Period(val value: String) {
    @SerialName("month") Month("month"),
    @SerialName("week") Week("week");
}

@Serializable
data class AgentWorkTask (
    val color: String? = null,

    @SerialName("completed_at")
    val completedAt: String? = null,

    @SerialName("cost_usd")
    val costUsd: Double? = null,

    @SerialName("due_on")
    val dueOn: String? = null,

    val icon: String? = null,
    val id: String,
    val number: Long? = null,
    val overdue: Boolean? = null,

    @SerialName("project_id")
    val projectID: String,

    @SerialName("project_key")
    val projectKey: String? = null,

    @SerialName("project_name")
    val projectName: String? = null,

    @SerialName("project_slug")
    val projectSlug: String? = null,

    val questions: Count? = null,
    val title: String,
    val tokens: Double? = null
)

@Serializable
data class AgentWorkTasks (
    @SerialName("next_cursor")
    val nextCursor: String? = null,

    val tasks: List<AgentWorkTask>
)

@Serializable
data class APIError (
    val error: Error
)

@Serializable
data class Error (
    val code: String,
    val message: String? = null,
    val workspace: RemovedFrom? = null
)

@Serializable
data class RemovedFrom (
    val id: String,
    val name: String
)

@Serializable
data class APIToken (
    @SerialName("actor_id")
    val actorID: String,

    @SerialName("created_at")
    val createdAt: String,

    @SerialName("deleted_at")
    val deletedAt: String? = null,

    @SerialName("expires_at")
    val expiresAt: String,

    val id: String,

    @SerialName("last_used_at")
    val lastUsedAt: String? = null,

    @SerialName("last_used_ip")
    val lastUsedIP: String? = null,

    val name: String,

    @SerialName("project_ids")
    val projectIDS: List<String>,

    @SerialName("revoked_at")
    val revokedAt: String? = null,

    @SerialName("updated_at")
    val updatedAt: String,

    @SerialName("workspace_id")
    val workspaceID: String
)

@Serializable
data class AtNumber (
    val id: String,
    val kind: String
)

@Serializable
data class AudienceChanged (
    val audience: String,
    val ok: Boolean,

    @SerialName("reader_ids")
    val readerIDS: List<String>
)

@Serializable
data class AuditEvent (
    @SerialName("actor_id")
    val actorID: String? = null,

    @SerialName("actor_name")
    val actorName: String? = null,

    val at: String,
    val id: String,
    val ip: String? = null,
    val kind: String,
    val meta: JsonElement? = null,
    val origin: String? = null,

    @SerialName("project_id")
    val projectID: String? = null,

    @SerialName("project_name")
    val projectName: String? = null,

    @SerialName("subject_id")
    val subjectID: String? = null,

    @SerialName("subject_name")
    val subjectName: String? = null,

    @SerialName("to_name")
    val toName: String? = null,

    @SerialName("user_agent")
    val userAgent: String? = null
)

@Serializable
data class AuditPage (
    val events: List<AuditEvent>,

    @SerialName("next_cursor")
    val nextCursor: String? = null
)

@Serializable
data class AuditPeople (
    val people: List<Person>
)

@Serializable
data class Person (
    @SerialName("actor_id")
    val actorID: String,

    val here: Boolean,
    val name: String
)

@Serializable
data class BlockerAdded (
    val blocker: TaskRelated
)

@Serializable
data class TaskRelated (
    @SerialName("completed_at")
    val completedAt: String? = null,

    val id: String,

    @SerialName("list_color")
    val listColor: String? = null,

    @SerialName("list_icon")
    val listIcon: String? = null,

    val number: Long,

    @SerialName("project_id")
    val projectID: String,

    @SerialName("project_key")
    val projectKey: String,

    @SerialName("project_slug")
    val projectSlug: String? = null,

    val title: String
)

@Serializable
data class Brand (
    @SerialName("icon_url")
    val iconURL: String? = null,

    @SerialName("mark_icon")
    val markIcon: String? = null,

    @SerialName("mark_tint")
    val markTint: Long,

    val name: String
)

@Serializable
data class Comment (
    @SerialName("author_id")
    val authorID: String,

    val body: JsonObject,

    @SerialName("created_at")
    val createdAt: String,

    @SerialName("deleted_at")
    val deletedAt: String? = null,

    val id: String,

    @SerialName("object_id")
    val objectID: String,

    @SerialName("object_type")
    val objectType: Type,

    val origin: Origin,

    @SerialName("updated_at")
    val updatedAt: String,

    @SerialName("workspace_id")
    val workspaceID: String
)

@Serializable
enum class Type(val value: String) {
    @SerialName("file") File("file"),
    @SerialName("message") Message("message"),
    @SerialName("post") Post("post"),
    @SerialName("task") Task("task");
}

@Serializable
data class CommentOnObject (
    val answer: Long? = null,

    @SerialName("answered_at")
    val answeredAt: String? = null,

    @SerialName("answered_by")
    val answeredBy: String? = null,

    @SerialName("answered_by_name")
    val answeredByName: String? = null,

    val asked: List<String>? = null,

    @SerialName("author_avatar_url")
    val authorAvatarURL: String? = null,

    @SerialName("author_id")
    val authorID: String,

    @SerialName("author_name")
    val authorName: String,

    val body: JsonObject,
    val choices: List<QuestionChoice>? = null,

    @SerialName("created_at")
    val createdAt: String,

    @SerialName("deleted_at")
    val deletedAt: String? = null,

    @SerialName("edited_at")
    val editedAt: String? = null,

    val id: String,

    @SerialName("object_id")
    val objectID: String? = null,

    @SerialName("object_type")
    val objectType: Type? = null,

    @SerialName("on_deleted_text")
    val onDeletedText: Boolean? = null,

    val origin: Origin,

    @SerialName("parent_id")
    val parentID: String? = null,

    val quote: String? = null,

    @SerialName("resolved_at")
    val resolvedAt: String? = null,

    @SerialName("resolved_by")
    val resolvedBy: String? = null,

    @SerialName("resolved_by_name")
    val resolvedByName: String? = null,

    @SerialName("updated_at")
    val updatedAt: String? = null,

    @SerialName("workspace_id")
    val workspaceID: String? = null
)

@Serializable
data class QuestionChoice (
    val label: String,
    val recommended: Boolean
)

@Serializable
data class CommentsPage (
    val comments: List<CommentOnObject>,

    @SerialName("next_cursor")
    val nextCursor: String? = null
)

@Serializable
data class Conversation (
    @SerialName("created_at")
    val createdAt: String,

    @SerialName("deleted_at")
    val deletedAt: String? = null,

    val id: String,
    val name: String? = null,

    @SerialName("project_id")
    val projectID: String? = null,

    @SerialName("updated_at")
    val updatedAt: String,

    @SerialName("workspace_id")
    val workspaceID: String
)

@Serializable
data class ConversationInList (
    val can: List<String>? = null,
    val channel: Boolean? = null,
    val chosen: Boolean? = null,

    @SerialName("created_at")
    val createdAt: String? = null,

    val hidden: Boolean? = null,
    val id: String,
    val left: Boolean? = null,
    val mentions: Count? = null,
    val name: String? = null,
    val notify: String? = null,

    @SerialName("other_avatar_url")
    val otherAvatarURL: String? = null,

    @SerialName("other_id")
    val otherID: String? = null,

    @SerialName("other_presence")
    val otherPresence: String? = null,

    val others: String? = null,

    @SerialName("others_gone")
    val othersGone: Boolean? = null,

    @SerialName("project_archived")
    val projectArchived: Boolean? = null,

    @SerialName("project_id")
    val projectID: String? = null,

    @SerialName("project_slug")
    val projectSlug: String? = null,

    @SerialName("read_through")
    val readThrough: String? = null,

    val unread: Count? = null
)

@Serializable
data class ConversationList (
    val conversations: List<ConversationInList>
)

@Serializable
data class Created (
    val id: String,
    val number: Long? = null
)

@Serializable
data class CycleInProject (
    @SerialName("ends_on")
    val endsOn: String? = null,

    val id: String,
    val name: String,

    @SerialName("starts_on")
    val startsOn: String? = null,

    val tasks: Count? = null
)

@Serializable
data class CyclesInProject (
    val cycles: List<CycleInProject>
)

@Serializable
data class DeletedFile (
    @SerialName("author_id")
    val authorID: String? = null,

    @SerialName("author_name")
    val authorName: String? = null,

    @SerialName("content_type")
    val contentType: String? = null,

    @SerialName("deleted_at")
    val deletedAt: String,

    @SerialName("deleted_by")
    val deletedBy: String? = null,

    @SerialName("deleted_by_name")
    val deletedByName: String? = null,

    @SerialName("held_files")
    val heldFiles: Long? = null,

    val id: String,
    val kind: String,

    @SerialName("mark_icon")
    val markIcon: String? = null,

    @SerialName("mark_tint")
    val markTint: Long? = null,

    val name: String,
    val number: Long? = null,

    @SerialName("purge_at")
    val purgeAt: String,

    @SerialName("size_bytes")
    val sizeBytes: CountOrNone? = null,

    @SerialName("thumb_url")
    val thumbURL: String? = null,

    val url: String? = null
)

@Serializable
data class DeletedFilesPage (
    val files: List<DeletedFile>,

    @SerialName("kept_days")
    val keptDays: Long,

    @SerialName("next_cursor")
    val nextCursor: String? = null
)

@Serializable
data class DeletionPlan (
    val alone: List<Alone>? = null,
    val asks: String? = null,
    val blocked: List<Blocked>? = null,
    val leaves: List<Leaf>? = null,
    val ok: Boolean,
    val why: String? = null
)

@Serializable
data class Alone (
    val name: String
)

@Serializable
data class Blocked (
    val name: String,
    val people: Long
)

@Serializable
data class Leaf (
    val name: String
)

@Serializable
data class DirectMade (
    val id: String
)

@Serializable
data class DocVersion (
    val contributors: List<VersionContributor>,

    @SerialName("created_at")
    val createdAt: String,

    val id: String,

    @SerialName("restored_version")
    val restoredVersion: Long? = null,

    val version: Long
)

@Serializable
data class VersionContributor (
    @SerialName("actor_id")
    val actorID: String,

    @SerialName("avatar_url")
    val avatarURL: String? = null,

    val name: String
)

@Serializable
data class DocVersionPage (
    @SerialName("next_cursor")
    val nextCursor: String? = null,

    val versions: List<DocVersion>
)

@Serializable
data class DocVersionRead (
    val version: Version
)

@Serializable
data class Version (
    val body: JsonObject,
    val contributors: List<VersionContributor>,

    @SerialName("created_at")
    val createdAt: String,

    val id: String,

    @SerialName("restored_version")
    val restoredVersion: Long? = null,

    val version: Long
)

@Serializable
data class DocVersionRestored (
    val ok: Boolean,
    val version: Long
)

@Serializable
data class FeedbackPublic (
    val available: Boolean,
    val brand: Brand? = null,
    val intro: String? = null,
    val mark: Mark,

    @SerialName("moved_to")
    val movedTo: String? = null,

    val name: String,
    val slug: String,

    @SerialName("turnstile_site_key")
    val turnstileSiteKey: String? = null
)

@Serializable
data class Mark (
    val icon: String,
    val tint: Long,
    val url: String? = null
)

@Serializable
data class FeedbackSettings (
    val following: Boolean,
    val may: Boolean,
    val page: Page? = null,
    val paid: Boolean,

    @SerialName("suggested_slug")
    val suggestedSlug: String,

    val triage: Boolean
)

@Serializable
data class Page (
    val id: String,
    val intro: String? = null,
    val live: Boolean,
    val name: String,
    val slug: String
)

@Serializable
data class File (
    @SerialName("author_id")
    val authorID: String,

    val body: JsonObject? = null,

    @SerialName("content_type")
    val contentType: String? = null,

    @SerialName("created_at")
    val createdAt: String,

    @SerialName("deleted_at")
    val deletedAt: String? = null,

    @SerialName("folder_id")
    val folderID: String? = null,

    val id: String,

    @SerialName("mark_icon")
    val markIcon: String? = null,

    @SerialName("mark_tint")
    val markTint: Long? = null,

    @SerialName("may_edit")
    val mayEdit: Boolean? = null,

    val name: String,
    val number: Long,

    @SerialName("pixel_height")
    val pixelHeight: Long? = null,

    @SerialName("pixel_width")
    val pixelWidth: Long? = null,

    @SerialName("project_id")
    val projectID: String,

    val rev: Long? = null,

    @SerialName("size_bytes")
    val sizeBytes: Long? = null,

    @SerialName("updated_at")
    val updatedAt: String,

    val upload: Boolean,
    val version: Long,

    @SerialName("workspace_id")
    val workspaceID: String
)

@Serializable
data class FileChanged (
    val conflicts: Long? = null,
    val ok: Boolean,
    val rev: Long? = null,
    val version: Long? = null
)

@Serializable
data class FileImported (
    @SerialName("content_type")
    val contentType: String,

    val id: String,
    val name: String,
    val size: Long
)

@Serializable
data class FileInDetail (
    val audience: String? = null,

    @SerialName("author_id")
    val authorID: String? = null,

    @SerialName("author_name")
    val authorName: String? = null,

    val body: JsonObject? = null,

    @SerialName("content_type")
    val contentType: String? = null,

    @SerialName("conversation_id")
    val conversationID: String? = null,

    @SerialName("created_at")
    val createdAt: String? = null,

    @SerialName("for_agents")
    val forAgents: Boolean? = null,

    val id: String,

    @SerialName("loose_files")
    val looseFiles: Long? = null,

    @SerialName("mark_icon")
    val markIcon: String? = null,

    @SerialName("mark_tint")
    val markTint: Long? = null,

    @SerialName("may_edit")
    val mayEdit: Boolean? = null,

    @SerialName("may_for_agents")
    val mayForAgents: Boolean? = null,

    @SerialName("may_share")
    val mayShare: Boolean? = null,

    val name: String,
    val number: Long? = null,

    @SerialName("origin_id")
    val originID: String? = null,

    @SerialName("origin_type")
    val originType: String? = null,

    @SerialName("pinned_at")
    val pinnedAt: String? = null,

    @SerialName("pixel_height")
    val pixelHeight: Long? = null,

    @SerialName("pixel_width")
    val pixelWidth: Long? = null,

    @SerialName("project_id")
    val projectID: String? = null,

    @SerialName("public_token")
    val publicToken: String? = null,

    @SerialName("reader_ids")
    val readerIDS: List<String>? = null,

    @SerialName("size_bytes")
    val sizeBytes: CountOrNone? = null,

    val subscribed: Boolean? = null,

    @SerialName("template_at")
    val templateAt: String? = null,

    @SerialName("updated_at")
    val updatedAt: String? = null,

    val upload: Boolean? = null,
    val url: String? = null,
    val version: Long? = null
)

@Serializable
data class FileInList (
    val audience: String? = null,

    @SerialName("author_id")
    val authorID: String? = null,

    @SerialName("author_name")
    val authorName: String? = null,

    @SerialName("content_type")
    val contentType: String? = null,

    @SerialName("created_at")
    val createdAt: String? = null,

    @SerialName("for_agents")
    val forAgents: Boolean? = null,

    val id: String,

    @SerialName("is_document")
    val isDocument: Boolean? = null,

    @SerialName("is_public")
    val isPublic: Boolean? = null,

    val kind: String,

    @SerialName("mark_icon")
    val markIcon: String? = null,

    @SerialName("mark_tint")
    val markTint: Long? = null,

    val name: String,
    val number: Long? = null,

    @SerialName("origin_id")
    val originID: String? = null,

    @SerialName("origin_post_title")
    val originPostTitle: String? = null,

    @SerialName("origin_room")
    val originRoom: String? = null,

    @SerialName("origin_room_channel")
    val originRoomChannel: Boolean? = null,

    @SerialName("origin_room_name")
    val originRoomName: String? = null,

    @SerialName("origin_room_project_slug")
    val originRoomProjectSlug: String? = null,

    @SerialName("origin_task_key")
    val originTaskKey: String? = null,

    @SerialName("origin_task_number")
    val originTaskNumber: Long? = null,

    @SerialName("origin_task_title")
    val originTaskTitle: String? = null,

    @SerialName("origin_type")
    val originType: String? = null,

    @SerialName("pinned_at")
    val pinnedAt: String? = null,

    val preview: Preview? = null,

    @SerialName("size_bytes")
    val sizeBytes: CountOrNone? = null,

    @SerialName("template_at")
    val templateAt: String? = null,

    @SerialName("thumb_url")
    val thumbURL: String? = null,

    @SerialName("updated_at")
    val updatedAt: String? = null,

    val url: String? = null,
    val version: Long? = null
)

@Serializable
data class Preview (
    val lines: List<Line>,
    val picture: String? = null,

    @SerialName("picture_url")
    val pictureURL: String? = null
)

@Serializable
data class Line (
    val h: Long,
    val t: String
)

@Serializable
data class FileLink (
    @SerialName("display_url")
    val displayURL: String? = null,

    @SerialName("expires_in")
    val expiresIn: Double? = null,

    val name: String? = null,
    val size: Double? = null,
    val url: String
)

@Serializable
data class FileRead (
    val comments: List<CommentOnObject>? = null,

    @SerialName("comments_earlier")
    val commentsEarlier: String? = null,

    val file: FileInDetail
)

@Serializable
data class FilesInProject (
    val files: List<FileInList>,
    val kinds: List<String>? = null,

    @SerialName("next_cursor")
    val nextCursor: String? = null
)

@Serializable
data class ForAgentsChanged (
    @SerialName("for_agents")
    val forAgents: Boolean,

    val ok: Boolean,
    val replaced: String? = null
)

@Serializable
data class GIFKey (
    val key: String? = null
)

@Serializable
data class GithubHello (
    @SerialName("can_install")
    val canInstall: Boolean,

    val configured: Boolean,
    val install: Install? = null
)

@Serializable
data class Install (
    @SerialName("account_login")
    val accountLogin: String,

    @SerialName("account_type")
    val accountType: String? = null
)

@Serializable
data class GithubLink (
    val issues: Boolean,

    @SerialName("linked_by")
    val linkedBy: String,

    @SerialName("linked_by_name")
    val linkedByName: String,

    val private: Boolean,

    @SerialName("repo_id")
    val repoID: String,

    @SerialName("repo_name")
    val repoName: String,

    @SerialName("stopped_at")
    val stoppedAt: String? = null
)

@Serializable
data class GithubRepo (
    val id: Long,
    val name: String,
    val private: Boolean,

    @SerialName("project_id")
    val projectID: String? = null
)

@Serializable
data class GithubRepos (
    val repos: List<GithubRepo>
)

@Serializable
data class HoursByPerson (
    @SerialName("actor_id")
    val actorID: String,

    @SerialName("actor_name")
    val actorName: String? = null,

    val minutes: Long,

    @SerialName("project_id")
    val projectID: String,

    @SerialName("project_name")
    val projectName: String? = null
)

@Serializable
data class HoursList (
    val time: List<HoursByPerson>
)

@Serializable
data class ImportProgress (
    val done: Boolean? = null,
    val issues: Long? = null,

    @SerialName("project_id")
    val projectID: String? = null,

    val reading: Long? = null
)

@Serializable
data class ImportTeam (
    val id: String,
    val issues: Long,
    val key: String,
    val name: String
)

@Serializable
data class ImportTeams (
    val teams: List<ImportTeam>
)

@Serializable
data class Inbox (
    @SerialName("next_cursor")
    val nextCursor: String? = null,

    val notifications: List<NotificationInInbox>,
    val questions: List<QuestionInInbox>? = null,
    val unread: Map<String, Count>? = null
)

@Serializable
data class NotificationInInbox (
    @SerialName("by_avatar_url")
    val byAvatarURL: String? = null,

    @SerialName("by_id")
    val byID: String? = null,

    @SerialName("by_name")
    val byName: String? = null,

    @SerialName("created_at")
    val createdAt: String,

    val excerpt: String? = null,
    val id: String,
    val kind: String? = null,

    @SerialName("object_id")
    val objectID: String,

    @SerialName("object_type")
    val objectType: String,

    @SerialName("project_id")
    val projectID: String? = null,

    @SerialName("project_key")
    val projectKey: String? = null,

    @SerialName("project_name")
    val projectName: String? = null,

    @SerialName("project_slug")
    val projectSlug: String? = null,

    @SerialName("read_at")
    val readAt: String? = null,

    val reason: String,

    @SerialName("room_channel")
    val roomChannel: Boolean? = null,

    @SerialName("room_name")
    val roomName: String? = null,

    @SerialName("room_others")
    val roomOthers: String? = null,

    val said: String? = null,

    @SerialName("said_by")
    val saidBy: String? = null,

    @SerialName("said_files")
    val saidFiles: List<String>? = null,

    @SerialName("said_id")
    val saidID: String? = null,

    @SerialName("said_thread")
    val saidThread: String? = null,

    @SerialName("task_number")
    val taskNumber: Long? = null,

    val title: String? = null,
    val what: String? = null
)

@Serializable
data class QuestionInInbox (
    val body: JsonObject,

    @SerialName("by_avatar_url")
    val byAvatarURL: String? = null,

    @SerialName("by_id")
    val byID: String,

    @SerialName("by_name")
    val byName: String,

    val choices: List<QuestionChoice>,

    @SerialName("created_at")
    val createdAt: String,

    val excerpt: String? = null,
    val id: String,

    @SerialName("project_id")
    val projectID: String,

    @SerialName("project_key")
    val projectKey: String? = null,

    @SerialName("project_name")
    val projectName: String,

    @SerialName("project_slug")
    val projectSlug: String,

    @SerialName("task_id")
    val taskID: String,

    @SerialName("task_number")
    val taskNumber: Long,

    val title: String
)

@Serializable
data class InboxCodeSent (
    @SerialName("sent_to")
    val sentTo: String
)

@Serializable
data class InboxSettings (
    @SerialName("email_digest")
    val emailDigest: Boolean,

    @SerialName("notify_chat")
    val notifyChat: Boolean,

    @SerialName("quiet_from")
    val quietFrom: String? = null,

    @SerialName("quiet_to")
    val quietTo: String? = null,

    val timezone: String? = null
)

@Serializable
data class Instance (
    val mail: Boolean,

    @SerialName("mail_setup")
    val mailSetup: MailSetup,

    val owners: List<InstanceOwner>,

    @SerialName("sign_up_open")
    val signUpOpen: Boolean,

    val version: ServerVersion
)

@Serializable
data class MailSetup (
    val host: String? = null,
    val port: Long? = null,

    @SerialName("secret_set")
    val secretSet: Boolean,

    val security: Security? = null,
    val sender: String? = null,
    val source: MailSetupSource? = null,
    val user: String? = null,
    val via: Via? = null
)

@Serializable
enum class Security(val value: String) {
    @SerialName("none") None("none"),
    @SerialName("starttls") Starttls("starttls"),
    @SerialName("tls") TLS("tls");
}

@Serializable
enum class MailSetupSource(val value: String) {
    @SerialName("env") Env("env"),
    @SerialName("saved") Saved("saved");
}

@Serializable
enum class Via(val value: String) {
    @SerialName("resend") Resend("resend"),
    @SerialName("smtp") SMTP("smtp");
}

@Serializable
data class InstanceOwner (
    @SerialName("actor_id")
    val actorID: String,

    @SerialName("added_at")
    val addedAt: String,

    val email: String? = null,
    val name: String
)

@Serializable
data class ServerVersion (
    val check: Boolean,
    val commit: String,
    val current: String,
    val latest: ServerRelease? = null,
    val updated: ServerUpdate? = null
)

@Serializable
data class ServerRelease (
    @SerialName("published_at")
    val publishedAt: String? = null,

    val security: Boolean,
    val url: String,
    val version: String
)

@Serializable
data class ServerUpdate (
    val at: String,
    val backup: String? = null,
    val from: String? = null,
    val migrations: Long,

    @SerialName("no_backup")
    val noBackup: NoBackup? = null,

    val notes: String? = null,
    val to: String
)

@Serializable
enum class NoBackup(val value: String) {
    @SerialName("no_folder") NoFolder("no_folder"),
    @SerialName("not_a_volume") NotAVolume("not_a_volume"),
    @SerialName("postgres_newer") PostgresNewer("postgres_newer"),
    @SerialName("skipped") Skipped("skipped");
}

@Serializable
data class InstanceLetter (
    val mail: Boolean,
    val sent: Boolean
)

@Serializable
data class Invite (
    @SerialName("created_at")
    val createdAt: String,

    @SerialName("created_by")
    val createdBy: String,

    @SerialName("deleted_at")
    val deletedAt: String? = null,

    val email: String? = null,

    @SerialName("expires_at")
    val expiresAt: String,

    val id: String,

    @SerialName("project_ids")
    val projectIDS: List<String>,

    val role: Role,

    @SerialName("updated_at")
    val updatedAt: String,

    @SerialName("used_at")
    val usedAt: String? = null,

    @SerialName("used_by")
    val usedBy: String? = null,

    @SerialName("workspace_id")
    val workspaceID: String
)

@Serializable
enum class Role(val value: String) {
    @SerialName("member") Member("member"),
    @SerialName("owner") Owner("owner");
}

@Serializable
data class InviteForMe (
    val brand: Brand? = null,
    val email: String? = null,
    val host: String? = null,
    val member: Boolean? = null,
    val role: String? = null,
    val state: String,

    @SerialName("workspace_id")
    val workspaceID: String? = null,

    @SerialName("workspace_name")
    val workspaceName: String? = null,

    val you: You? = null
)

@Serializable
data class You (
    val email: String? = null,
    val name: String
)

@Serializable
data class InviteList (
    val invites: List<InviteRow>
)

@Serializable
data class InviteRow (
    @SerialName("created_at")
    val createdAt: String,

    @SerialName("deleted_at")
    val deletedAt: String? = null,

    val email: String? = null,

    @SerialName("expires_at")
    val expiresAt: String,

    val id: String,

    @SerialName("project_ids")
    val projectIDS: List<String>,

    val rights: List<String>,
    val role: String,

    @SerialName("send_again")
    val sendAgain: Boolean? = null,

    @SerialName("used_at")
    val usedAt: String? = null,

    @SerialName("used_by")
    val usedBy: String? = null
)

@Serializable
data class InviteMade (
    val id: String,
    val mailed: Boolean,
    val token: String
)

@Serializable
data class InvitePreview (
    val brand: Brand? = null,
    val email: String? = null,
    val host: String? = null,
    val role: String? = null,
    val state: String,

    @SerialName("workspace_name")
    val workspaceName: String? = null
)

@Serializable
data class LabelInProject (
    val color: String? = null,
    val id: String,
    val name: String,

    @SerialName("project_id")
    val projectID: String,

    val used: Count? = null
)

@Serializable
data class LabelOnTask (
    val color: String? = null,
    val id: String,
    val name: String
)

@Serializable
data class LabelsInProject (
    val labels: List<LabelInProject>
)

@Serializable
data class LeftWorkspace (
    val ok: Boolean,
    val session: Session,
    val workspace: Workspace? = null
)

@Serializable
data class Session (
    @SerialName("access_token")
    val accessToken: String,

    @SerialName("actor_id")
    val actorID: String,

    @SerialName("expires_in")
    val expiresIn: Long,

    @SerialName("refresh_token")
    val refreshToken: String,

    @SerialName("workspace_id")
    val workspaceID: String? = null,

    val nowhere: Boolean? = null
)

@Serializable
data class Workspace (
    val id: String,
    val name: String,
    val slug: String
)

@Serializable
data class LinkBack (
    val id: String,

    @SerialName("project_id")
    val projectID: String? = null,

    val title: String,
    val type: String
)

@Serializable
data class LinkPreview (
    val description: String? = null,
    val image: String? = null,
    val site: String? = null,
    val title: String,
    val url: String
)

@Serializable
data class LinksBack (
    val links: List<LinkBack>
)

@Serializable
data class ListInProject (
    @SerialName("agent_gone")
    val agentGone: Boolean? = null,

    @SerialName("agent_id")
    val agentID: String? = null,

    val color: String? = null,
    val finishes: Boolean? = null,
    val icon: String? = null,
    val id: String,
    val intake: Boolean? = null,
    val name: String,
    val narrow: Boolean? = null,

    @SerialName("sort_key")
    val sortKey: String? = null,

    val tasks: Count? = null
)

@Serializable
data class ListPage (
    val id: String,

    @SerialName("next_cursor")
    val nextCursor: String? = null,

    val total: Long
)

@Serializable
data class ListsInProject (
    val lists: List<ListInProject>
)

@Serializable
data class Me (
    val actor: MeActor,
    val can: List<String>,

    @SerialName("can_off_host")
    val canOffHost: List<String>? = null,

    val host: String? = null,
    val plan: String? = null,
    val role: String,
    val server: ServerVersion? = null,
    val settings: Settings? = null,

    @SerialName("via_mcp")
    val viaMCP: Boolean? = null,

    val workspace: MeWorkspace
)

@Serializable
data class MeActor (
    @SerialName("avatar_url")
    val avatarURL: String? = null,

    val chosen: String? = null,
    val id: String,
    val language: String? = null,
    val name: String,
    val presence: String? = null,
    val timezone: String? = null,
    val title: String? = null
)

@Serializable
data class Settings (
    @SerialName("edit_others_content")
    val editOthersContent: EditOthersContent? = null,

    @SerialName("who_creates_projects")
    val whoCreatesProjects: Who? = null,

    @SerialName("who_invites_people")
    val whoInvitesPeople: Who? = null,

    @SerialName("who_sees_members")
    val whoSeesMembers: Who? = null
)

@Serializable
enum class EditOthersContent(val value: String) {
    @SerialName("documents_too") DocumentsToo("documents_too"),
    @SerialName("own_only") OwnOnly("own_only");
}

@Serializable
enum class Who(val value: String) {
    @SerialName("members") Members("members"),
    @SerialName("owner") Owner("owner");
}

@Serializable
data class MeWorkspace (
    val brand: Brand? = null,

    @SerialName("domain_stopped")
    val domainStopped: Boolean? = null,

    @SerialName("icon_url")
    val iconURL: String? = null,

    val id: String,

    @SerialName("mark_icon")
    val markIcon: String? = null,

    @SerialName("mark_tint")
    val markTint: Long? = null,

    val name: String,
    val origin: String? = null,
    val slug: String
)

@Serializable
data class MeEmail (
    val asks: AsksClass,
    val email: String,
    val pending: Pending? = null
)

@Serializable
data class AsksClass (
    val code: Boolean,
    val inbox: Boolean? = null,
    val password: Boolean
)

@Serializable
data class Pending (
    val approve: Boolean,
    val email: String
)

@Serializable
data class Membership (
    @SerialName("actor_id")
    val actorID: String,

    @SerialName("created_at")
    val createdAt: String,

    @SerialName("deleted_at")
    val deletedAt: String? = null,

    val id: String,

    @SerialName("invited_by")
    val invitedBy: String? = null,

    @SerialName("joined_at")
    val joinedAt: String? = null,

    val role: Role,

    @SerialName("updated_at")
    val updatedAt: String,

    @SerialName("workspace_id")
    val workspaceID: String
)

@Serializable
data class Message (
    @SerialName("author_id")
    val authorID: String,

    val body: JsonObject,

    @SerialName("conversation_id")
    val conversationID: String,

    @SerialName("created_at")
    val createdAt: String,

    @SerialName("deleted_at")
    val deletedAt: String? = null,

    @SerialName("edited_at")
    val editedAt: String? = null,

    val id: String,
    val origin: Origin,

    @SerialName("parent_id")
    val parentID: String? = null,

    @SerialName("updated_at")
    val updatedAt: String,

    @SerialName("workspace_id")
    val workspaceID: String
)

@Serializable
data class MessageInRoom (
    @SerialName("also_in_room")
    val alsoInRoom: Boolean? = null,

    @SerialName("author_avatar_url")
    val authorAvatarURL: String? = null,

    @SerialName("author_id")
    val authorID: String? = null,

    @SerialName("author_name")
    val authorName: String,

    val body: JsonObject? = null,

    @SerialName("conversation_id")
    val conversationID: String? = null,

    @SerialName("created_at")
    val createdAt: String,

    val deleted: Boolean? = null,

    @SerialName("deleted_at")
    val deletedAt: String? = null,

    @SerialName("edited_at")
    val editedAt: String? = null,

    @SerialName("hook_id")
    val hookID: String? = null,

    val id: String,

    @SerialName("last_reply_at")
    val lastReplyAt: String? = null,

    val origin: Origin,

    @SerialName("parent_id")
    val parentID: String? = null,

    @SerialName("promoted_task_id")
    val promotedTaskID: String? = null,

    val reactions: List<Reaction>? = null,
    val repliers: List<Replier>? = null,
    val replies: Count? = null,

    @SerialName("said_as")
    val saidAs: String? = null,

    @SerialName("thread_said")
    val threadSaid: String? = null,

    @SerialName("updated_at")
    val updatedAt: String? = null,

    @SerialName("workspace_id")
    val workspaceID: String? = null
)

@Serializable
data class Reaction (
    val actors: List<String>,
    val emoji: String
)

@Serializable
data class Replier (
    @SerialName("avatar_url")
    val avatarURL: String? = null,

    val id: String,
    val name: String
)

@Serializable
data class MessagePage (
    val messages: List<MessageInRoom>,

    @SerialName("next_cursor")
    val nextCursor: String? = null
)

@Serializable
data class MessagesImported (
    val ids: Map<String, String>
)

@Serializable
data class MyTask (
    val color: String? = null,

    @SerialName("completed_at")
    val completedAt: String? = null,

    @SerialName("due_on")
    val dueOn: String? = null,

    val icon: String? = null,
    val id: String,

    @SerialName("list_name")
    val listName: String? = null,

    val number: Long,

    @SerialName("project_id")
    val projectID: String,

    @SerialName("project_key")
    val projectKey: String,

    @SerialName("project_name")
    val projectName: String,

    @SerialName("project_slug")
    val projectSlug: String? = null,

    @SerialName("reminder_at")
    val reminderAt: String? = null,

    val repeat: Repeat? = null,
    val title: String
)

@Serializable
data class Repeat (
    val day: Long? = null,
    val every: Every,
    val from: From? = null,
    val interval: Long? = null,
    val month: Long? = null,
    val weekdays: List<Long>? = null
)

@Serializable
enum class Every(val value: String) {
    @SerialName("day") Day("day"),
    @SerialName("month") Month("month"),
    @SerialName("week") Week("week"),
    @SerialName("year") Year("year");
}

@Serializable
enum class From(val value: String) {
    @SerialName("done") Done("done"),
    @SerialName("due") Due("due");
}

@Serializable
data class MyTaskList (
    val tasks: List<MyTask>
)

@Serializable
data class Nameable (
    @SerialName("completed_at")
    val completedAt: String? = null,

    val id: String,
    val kind: String? = null,
    val number: Long? = null,

    @SerialName("project_id")
    val projectID: String,

    @SerialName("project_key")
    val projectKey: String? = null,

    val title: String
)

@Serializable
data class Nameables (
    val tasks: List<Nameable>
)

@Serializable
data class Notification (
    @SerialName("actor_id")
    val actorID: String,

    @SerialName("created_at")
    val createdAt: String,

    @SerialName("deleted_at")
    val deletedAt: String? = null,

    val id: String,

    @SerialName("object_id")
    val objectID: String,

    @SerialName("object_type")
    val objectType: String,

    @SerialName("read_at")
    val readAt: String? = null,

    val reason: Reason,

    @SerialName("updated_at")
    val updatedAt: String,

    @SerialName("workspace_id")
    val workspaceID: String
)

@Serializable
enum class Reason(val value: String) {
    @SerialName("assigned") Assigned("assigned"),
    @SerialName("joined") Joined("joined"),
    @SerialName("mentioned") Mentioned("mentioned"),
    @SerialName("messaged") Messaged("messaged"),
    @SerialName("subscribed") Subscribed("subscribed");
}

@Serializable
data class NowhereMe (
    val actor: ActorClass,
    val can: List<String>,
    val email: String,
    val nowhere: Boolean,
    val role: JsonElement? = null,
    val workspace: JsonElement? = null
)

@Serializable
data class ActorClass (
    @SerialName("avatar_url")
    val avatarURL: String? = null,

    val id: String,
    val name: String
)

@Serializable
data class NowhereSession (
    @SerialName("access_token")
    val accessToken: String,

    @SerialName("actor_id")
    val actorID: String,

    @SerialName("expires_in")
    val expiresIn: Long,

    val nowhere: Boolean,

    @SerialName("refresh_token")
    val refreshToken: String,

    @SerialName("workspace_id")
    val workspaceID: JsonElement? = null
)

@Serializable
data class ObjectLink (
    @SerialName("created_at")
    val createdAt: String,

    @SerialName("created_by")
    val createdBy: String,

    @SerialName("deleted_at")
    val deletedAt: String? = null,

    @SerialName("from_id")
    val fromID: String,

    @SerialName("from_type")
    val fromType: Type,

    val id: String,

    @SerialName("to_id")
    val toID: String,

    @SerialName("to_type")
    val toType: Type,

    @SerialName("updated_at")
    val updatedAt: String,

    @SerialName("workspace_id")
    val workspaceID: String
)

@Serializable
data class OpenOnPerson (
    val color: String? = null,

    @SerialName("due_on")
    val dueOn: String? = null,

    val icon: String? = null,
    val id: String,
    val number: Long? = null,
    val overdue: Boolean? = null,

    @SerialName("project_id")
    val projectID: String,

    @SerialName("project_key")
    val projectKey: String? = null,

    @SerialName("project_name")
    val projectName: String? = null,

    @SerialName("project_slug")
    val projectSlug: String? = null,

    val title: String
)

@Serializable
data class PasswordChanged (
    val ok: Boolean,

    @SerialName("signed_out")
    val signedOut: Long? = null
)

@Serializable
data class PasswordSet (
    @SerialName("access_token")
    val accessToken: String? = null,

    @SerialName("actor_id")
    val actorID: String? = null,

    @SerialName("expires_in")
    val expiresIn: Long? = null,

    val ok: Boolean,

    @SerialName("refresh_token")
    val refreshToken: String? = null,

    @SerialName("signed_out")
    val signedOut: Long? = null,

    @SerialName("workspace_id")
    val workspaceID: String? = null
)

@Serializable
data class PendingClass (
    val approve: Boolean? = null,
    val email: String? = null,
    val pending: Boolean
)

@Serializable
data class PeopleList (
    val people: List<PersonInWorkspace>
)

@Serializable
data class PersonInWorkspace (
    @SerialName("active_at")
    val activeAt: String? = null,

    @SerialName("actor_id")
    val actorID: String,

    val agent: Boolean? = null,

    @SerialName("avatar_url")
    val avatarURL: String? = null,

    @SerialName("connected_by_name")
    val connectedByName: String? = null,

    @SerialName("connects_agents")
    val connectsAgents: Boolean? = null,

    @SerialName("creates_projects")
    val createsProjects: Boolean? = null,

    @SerialName("invites_people")
    val invitesPeople: Boolean? = null,

    @SerialName("joined_at")
    val joinedAt: String? = null,

    @SerialName("may_connect_agents")
    val mayConnectAgents: Boolean? = null,

    @SerialName("may_create_channels")
    val mayCreateChannels: Boolean? = null,

    @SerialName("may_create_projects")
    val mayCreateProjects: Boolean? = null,

    @SerialName("may_invite_people")
    val mayInvitePeople: Boolean? = null,

    @SerialName("may_see_members")
    val maySeeMembers: Boolean? = null,

    val name: String,
    val presence: Presence? = null,
    val role: String? = null,

    @SerialName("sees_members")
    val seesMembers: Boolean? = null,

    val status: AgentStatus? = null,
    val title: String? = null
)

@Serializable
enum class Presence(val value: String) {
    @SerialName("away") Away("away"),
    @SerialName("busy") Busy("busy"),
    @SerialName("here") Here("here");
}

@Serializable
data class PersonDay (
    val day: String,
    val n: Count
)

@Serializable
data class PersonHours (
    val minutes: Long,
    val number: Long? = null,

    @SerialName("project_id")
    val projectID: String,

    @SerialName("project_name")
    val projectName: String? = null,

    @SerialName("task_id")
    val taskID: String? = null,

    val title: String? = null
)

@Serializable
data class PersonInProject (
    @SerialName("active_at")
    val activeAt: String? = null,

    @SerialName("actor_id")
    val actorID: String,

    val agent: Boolean? = null,

    @SerialName("avatar_url")
    val avatarURL: String? = null,

    @SerialName("connected_by_name")
    val connectedByName: String? = null,

    @SerialName("connects_agents")
    val connectsAgents: Boolean? = null,

    @SerialName("creates_projects")
    val createsProjects: Boolean? = null,

    @SerialName("invites_people")
    val invitesPeople: Boolean? = null,

    @SerialName("joined_at")
    val joinedAt: String? = null,

    @SerialName("may_connect_agents")
    val mayConnectAgents: Boolean? = null,

    @SerialName("may_create_channels")
    val mayCreateChannels: Boolean? = null,

    @SerialName("may_create_projects")
    val mayCreateProjects: Boolean? = null,

    @SerialName("may_invite_people")
    val mayInvitePeople: Boolean? = null,

    @SerialName("may_see_members")
    val maySeeMembers: Boolean? = null,

    val name: String,
    val presence: Presence? = null,
    val rights: List<String>,
    val role: String? = null,

    @SerialName("sees_members")
    val seesMembers: Boolean? = null,

    val status: AgentStatus? = null,
    val title: String? = null
)

@Serializable
data class PersonOnPage (
    @SerialName("actor_id")
    val actorID: String,

    @SerialName("avatar_url")
    val avatarURL: String? = null,

    val email: String? = null,

    @SerialName("joined_at")
    val joinedAt: String? = null,

    val name: String,
    val presence: String? = null,
    val role: String? = null,
    val timezone: String? = null,
    val title: String? = null
)

@Serializable
data class PersonPage (
    val days: List<PersonDay>? = null,
    val hours: List<PersonHours>? = null,
    val open: List<OpenOnPerson>? = null,
    val person: PersonOnPage,
    val projects: List<Project>? = null,
    val shared: List<SharedProject>? = null,
    val weeks: List<PersonWeek>? = null
)

@Serializable
data class Project (
    val id: String,
    val key: String? = null,
    val name: String,
    val slug: String? = null
)

@Serializable
data class SharedProject (
    val done: Count? = null,
    val id: String,
    val key: String? = null,
    val name: String,
    val open: Count? = null,
    val overdue: Count? = null,
    val slug: String? = null
)

@Serializable
data class PersonWeek (
    val done: Count,
    val said: Count,
    val week: String
)

@Serializable
data class Post (
    @SerialName("author_id")
    val authorID: String,

    val body: JsonObject,
    val category: String? = null,

    @SerialName("created_at")
    val createdAt: String,

    @SerialName("deleted_at")
    val deletedAt: String? = null,

    val id: String,
    val number: Long,

    @SerialName("project_id")
    val projectID: String,

    @SerialName("published_at")
    val publishedAt: String? = null,

    val schedule: String? = null,
    val title: String,

    @SerialName("updated_at")
    val updatedAt: String,

    @SerialName("workspace_id")
    val workspaceID: String
)

@Serializable
data class PostInList (
    @SerialName("author_avatar_url")
    val authorAvatarURL: String? = null,

    @SerialName("author_id")
    val authorID: String,

    @SerialName("author_name")
    val authorName: String,

    val body: JsonObject,
    val category: String? = null,

    @SerialName("created_at")
    val createdAt: String,

    @SerialName("deleted_at")
    val deletedAt: String? = null,

    val id: String,
    val number: Long,

    @SerialName("project_id")
    val projectID: String,

    @SerialName("published_at")
    val publishedAt: String? = null,

    @SerialName("reply_count")
    val replyCount: Long,

    val schedule: String? = null,
    val title: String,

    @SerialName("updated_at")
    val updatedAt: String? = null,

    @SerialName("workspace_id")
    val workspaceID: String? = null
)

@Serializable
data class PostInProject (
    val audience: String? = null,

    @SerialName("author_avatar_url")
    val authorAvatarURL: String? = null,

    @SerialName("author_id")
    val authorID: String? = null,

    @SerialName("author_name")
    val authorName: String? = null,

    val body: JsonObject? = null,
    val category: String? = null,

    @SerialName("created_at")
    val createdAt: String,

    val id: String,
    val number: Long? = null,

    @SerialName("project_id")
    val projectID: String? = null,

    @SerialName("published_at")
    val publishedAt: String? = null,

    @SerialName("reply_count")
    val replyCount: Count? = null,

    val schedule: String? = null,
    val title: String,

    @SerialName("updated_at")
    val updatedAt: String? = null
)

@Serializable
data class PostPage (
    val drafts: List<PostInProject>? = null,

    @SerialName("next_cursor")
    val nextCursor: String? = null,

    val posts: List<PostInProject>
)

@Serializable
data class PostPublished (
    val audience: String,
    val ok: Boolean,

    @SerialName("published_at")
    val publishedAt: String? = null
)

@Serializable
data class PostRead (
    val comments: List<CommentOnObject>? = null,

    @SerialName("comments_earlier")
    val commentsEarlier: String? = null,

    val post: PostClass
)

@Serializable
data class PostClass (
    val audience: String? = null,

    @SerialName("author_agent")
    val authorAgent: Boolean? = null,

    @SerialName("author_avatar_url")
    val authorAvatarURL: String? = null,

    @SerialName("author_id")
    val authorID: String? = null,

    @SerialName("author_name")
    val authorName: String? = null,

    val body: JsonObject? = null,
    val category: String? = null,

    @SerialName("created_at")
    val createdAt: String,

    val id: String,

    @SerialName("may_delete")
    val mayDelete: Boolean? = null,

    @SerialName("may_edit")
    val mayEdit: Boolean? = null,

    val number: Long? = null,

    @SerialName("project_id")
    val projectID: String? = null,

    @SerialName("published_at")
    val publishedAt: String? = null,

    @SerialName("reply_count")
    val replyCount: Count? = null,

    val schedule: String? = null,
    val subscribed: Boolean? = null,
    val title: String,

    @SerialName("updated_at")
    val updatedAt: String? = null
)

@Serializable
data class ProjectClass (
    @SerialName("archived_at")
    val archivedAt: String? = null,

    @SerialName("created_at")
    val createdAt: String,

    @SerialName("deleted_at")
    val deletedAt: String? = null,

    val description: String? = null,
    val id: String,
    val key: String,
    val name: String,
    val sample: Boolean,
    val slug: String,
    val tools: List<Tool>,

    @SerialName("updated_at")
    val updatedAt: String,

    @SerialName("workspace_id")
    val workspaceID: String
)

@Serializable
enum class Tool(val value: String) {
    @SerialName("files") Files("files"),
    @SerialName("messages") Messages("messages"),
    @SerialName("posts") Posts("posts"),
    @SerialName("tasks") Tasks("tasks");
}

@Serializable
data class ProjectBin (
    val projects: List<ProjectInBin>
)

@Serializable
data class ProjectInBin (
    @SerialName("deleted_at")
    val deletedAt: String,

    val description: String? = null,
    val id: String,
    val name: String
)

@Serializable
data class ProjectGithub (
    val link: GithubLink? = null
)

@Serializable
data class ProjectInList (
    @SerialName("archived_at")
    val archivedAt: String? = null,

    val can: List<String>? = null,

    @SerialName("created_at")
    val createdAt: String? = null,

    @SerialName("deleted_at")
    val deletedAt: String? = null,

    val description: String? = null,

    @SerialName("for_agents")
    val forAgents: ForAgents? = null,

    @SerialName("icon_url")
    val iconURL: String? = null,

    val id: String,
    val key: String,

    @SerialName("mark_icon")
    val markIcon: String? = null,

    @SerialName("mark_tint")
    val markTint: Long? = null,

    val name: String,
    val sample: Boolean,
    val slug: String,
    val tools: List<Tool>,

    @SerialName("updated_at")
    val updatedAt: String? = null,

    @SerialName("workspace_id")
    val workspaceID: String? = null
)

@Serializable
data class ForAgents (
    val id: String,
    val name: String,
    val number: Long? = null
)

@Serializable
data class ProjectMember (
    @SerialName("actor_id")
    val actorID: String,

    @SerialName("added_by")
    val addedBy: String? = null,

    @SerialName("created_at")
    val createdAt: String,

    @SerialName("deleted_at")
    val deletedAt: String? = null,

    val id: String,

    @SerialName("project_id")
    val projectID: String,

    @SerialName("updated_at")
    val updatedAt: String,

    @SerialName("workspace_id")
    val workspaceID: String
)

@Serializable
data class ProjectMembers (
    val members: List<PersonInProject>
)

@Serializable
data class ProjectPage (
    @SerialName("next_cursor")
    val nextCursor: String? = null,

    val projects: List<ProjectInList>
)

@Serializable
data class ProjectSlack (
    val link: SlackLink? = null
)

@Serializable
data class SlackLink (
    @SerialName("channel_id")
    val channelID: String,

    @SerialName("channel_name")
    val channelName: String,

    @SerialName("linked_by_name")
    val linkedByName: String,

    val private: Boolean,
    val stopped: String? = null,

    @SerialName("stopped_at")
    val stoppedAt: String? = null
)

@Serializable
data class Providers (
    val apple: Boolean,
    val github: Boolean,
    val google: Boolean,
    val mail: Boolean,

    @SerialName("no_mail")
    val noMail: Boolean,

    val oidc: Boolean,

    @SerialName("oidc_name")
    val oidcName: String? = null,

    @SerialName("sign_up")
    val signUp: Boolean
)

@Serializable
data class PublicDocument (
    val body: JsonObject? = null,
    val brand: Brand? = null,
    val name: String,
    val pictures: Map<String, Picture>,

    @SerialName("updated_at")
    val updatedAt: String
)

@Serializable
data class Picture (
    @SerialName("display_url")
    val displayURL: String? = null,

    val url: String
)

@Serializable
data class PublicShare (
    val token: String? = null
)

@Serializable
data class PullOnTask (
    @SerialName("author_avatar")
    val authorAvatar: String? = null,

    @SerialName("author_login")
    val authorLogin: String? = null,

    val checks: String? = null,
    val closes: Boolean,
    val draft: Boolean,

    @SerialName("head_ref")
    val headRef: String? = null,

    val number: Long,

    @SerialName("repo_name")
    val repoName: String,

    val review: String? = null,
    val state: String,
    val title: String,
    val url: String
)

@Serializable
data class PushDevice (
    @SerialName("created_at")
    val createdAt: String,

    val id: String,
    val kind: String,

    @SerialName("last_used_at")
    val lastUsedAt: String? = null,

    val said: String? = null
)

@Serializable
data class PushDevices (
    val apns: Boolean,
    val devices: List<PushDevice>,
    val fcm: Boolean? = null,
    val key: String? = null
)

@Serializable
data class PushTried (
    val devices: List<PushTriedDevice>
)

@Serializable
data class PushTriedDevice (
    val id: String,
    val kind: String,
    val reason: String? = null,
    val said: String? = null,
    val status: Long
)

@Serializable
data class QuestionAnswer (
    val answer: Long? = null,

    @SerialName("answered_at")
    val answeredAt: String? = null,

    @SerialName("answered_by")
    val answeredBy: String? = null,

    @SerialName("answered_by_name")
    val answeredByName: String? = null,

    val choices: List<QuestionChoice>,
    val id: String? = null,

    @SerialName("object_id")
    val objectID: String? = null,

    val ok: Boolean? = null
)

@Serializable
data class RealtimeEvent (
    val kind: String,
    val payload: Payload? = null,
    val topic: String
)

@Serializable
data class Payload (
    @SerialName("actor_id")
    val actorID: String? = null,

    @SerialName("conversation_id")
    val conversationID: String? = null,

    val id: String? = null,

    @SerialName("object_id")
    val objectID: String? = null,

    @SerialName("object_type")
    val objectType: String? = null,

    @SerialName("project_id")
    val projectID: String? = null,

    val reason: String? = null,
    val tab: String? = null
)

@Serializable
data class RecoveryCodes (
    @SerialName("recovery_codes")
    val recoveryCodes: List<String>
)

@Serializable
data class Rewait (
    val id: String,

    @SerialName("waiting_on")
    val waitingOn: List<String>
)

@Serializable
data class RoomHook (
    @SerialName("created_at")
    val createdAt: String,

    @SerialName("created_by")
    val createdBy: String,

    @SerialName("created_by_name")
    val createdByName: String,

    val id: String,

    @SerialName("last_used_at")
    val lastUsedAt: String? = null,

    val name: String,

    @SerialName("stopped_at")
    val stoppedAt: String? = null,

    @SerialName("turned_at")
    val turnedAt: String? = null
)

@Serializable
data class RoomHookAddress (
    val id: String,
    val name: String,
    val url: String
)

@Serializable
data class RoomHooks (
    val hooks: List<RoomHook>
)

@Serializable
data class RoomPeople (
    val chosen: Boolean? = null,
    val members: List<RoomPerson>
)

@Serializable
data class RoomPerson (
    @SerialName("actor_id")
    val actorID: String,

    @SerialName("avatar_url")
    val avatarURL: String? = null,

    val name: String,
    val presence: String? = null,
    val role: String? = null,
    val title: String? = null
)

@Serializable
data class SavedTemplate (
    val id: String,
    val name: String,

    @SerialName("project_id")
    val projectID: String,

    @SerialName("project_name")
    val projectName: String,

    @SerialName("template_at")
    val templateAt: String
)

@Serializable
data class SavedTemplates (
    val templates: List<SavedTemplate>
)

@Serializable
data class SearchResult (
    @SerialName("author_name")
    val authorName: String? = null,

    @SerialName("conversation_id")
    val conversationID: String? = null,

    @SerialName("created_at")
    val createdAt: String? = null,

    val id: String,

    @SerialName("mark_icon")
    val markIcon: String? = null,

    @SerialName("mark_tint")
    val markTint: Long? = null,

    val number: Long? = null,

    @SerialName("parent_id")
    val parentID: String? = null,

    @SerialName("project_id")
    val projectID: String? = null,

    val snippet: String? = null,
    val title: String? = null,
    val type: String
)

@Serializable
data class SearchResults (
    val results: List<SearchResult>
)

@Serializable
data class SessionClass (
    @SerialName("access_token")
    val accessToken: String,

    @SerialName("actor_id")
    val actorID: String,

    @SerialName("expires_in")
    val expiresIn: Long,

    @SerialName("refresh_token")
    val refreshToken: String,

    @SerialName("workspace_id")
    val workspaceID: String
)

@Serializable
data class SessionRow (
    @SerialName("created_at")
    val createdAt: String,

    val current: Boolean? = null,

    @SerialName("expires_at")
    val expiresAt: String? = null,

    val host: String? = null,
    val id: String,
    val ip: String? = null,

    @SerialName("last_used_at")
    val lastUsedAt: String? = null,

    val sessions: Count? = null,

    @SerialName("user_agent")
    val userAgent: String? = null
)

@Serializable
data class Sessions (
    val sessions: List<SessionRow>
)

@Serializable
data class SetupMail (
    @SerialName("mail_setup")
    val mailSetup: MailSetup
)

@Serializable
data class SetupState (
    @SerialName("mail_setup")
    val mailSetup: MailSetup,

    @SerialName("owner_email")
    val ownerEmail: String? = null
)

@Serializable
data class SignInCodeAsked (
    val sent: Boolean
)

@Serializable
data class SlackChannel (
    val id: String,
    val name: String,
    val private: Boolean
)

@Serializable
data class SlackChannels (
    val channels: List<SlackChannel>
)

@Serializable
data class SlackHello (
    @SerialName("can_connect")
    val canConnect: Boolean,

    val configured: Boolean,
    val connection: SlackHelloConnection? = null
)

@Serializable
data class SlackHelloConnection (
    val broken: Boolean,
    val previews: Boolean,

    @SerialName("team_name")
    val teamName: String
)

@Serializable
data class SpendList (
    val spend: List<Spend>
)

@Serializable
data class Spend (
    @SerialName("actor_id")
    val actorID: String,

    @SerialName("actor_name")
    val actorName: String? = null,

    val client: String,

    @SerialName("cost_usd")
    val costUsd: Double? = null,

    @SerialName("project_id")
    val projectID: String,

    @SerialName("project_name")
    val projectName: String? = null,

    val tokens: Double
)

@Serializable
data class SpendOnTask (
    @SerialName("actor_id")
    val actorID: String,

    @SerialName("actor_name")
    val actorName: String? = null,

    val client: String,

    @SerialName("cost_usd")
    val costUsd: Double? = null,

    @SerialName("created_at")
    val createdAt: String? = null,

    val id: String,
    val model: String? = null,
    val tokens: Double,

    @SerialName("updated_at")
    val updatedAt: String? = null
)

@Serializable
data class Step (
    @SerialName("assignee_id")
    val assigneeID: String? = null,

    @SerialName("assignee_ids")
    val assigneeIDS: List<String>? = null,

    val color: String? = null,

    @SerialName("done_at")
    val doneAt: String? = null,

    @SerialName("due_on")
    val dueOn: String? = null,

    val icon: String? = null,
    val id: String,

    @SerialName("sort_key")
    val sortKey: String? = null,

    val title: String
)

@Serializable
data class StepChanged (
    val ok: Boolean,
    val rewaits: List<Rewait>? = null,
    val task: TaskInProject? = null
)

@Serializable
data class TaskInProject (
    @SerialName("assignee_id")
    val assigneeID: String? = null,

    @SerialName("assignee_ids")
    val assigneeIDS: List<String>? = null,

    @SerialName("author_id")
    val authorID: String? = null,

    @SerialName("completed_at")
    val completedAt: String? = null,

    @SerialName("created_at")
    val createdAt: String? = null,

    @SerialName("cycle_id")
    val cycleID: String? = null,

    @SerialName("decided_at")
    val decidedAt: String? = null,

    @SerialName("due_on")
    val dueOn: String? = null,

    @SerialName("ends_at")
    val endsAt: String? = null,

    val id: String,
    val labels: List<LabelOnTask>? = null,

    @SerialName("list_id")
    val listID: String? = null,

    val number: Long,

    @SerialName("parent_id")
    val parentID: String? = null,

    val picture: TaskPicture? = null,
    val priority: String? = null,
    val repeat: Repeat? = null,

    @SerialName("sort_key")
    val sortKey: String? = null,

    @SerialName("starts_at")
    val startsAt: String? = null,

    val title: String,

    @SerialName("updated_at")
    val updatedAt: String? = null,

    @SerialName("waiting_on")
    val waitingOn: List<String>? = null
)

@Serializable
data class TaskPicture (
    @SerialName("file_id")
    val fileID: String,

    val height: Long? = null,

    @SerialName("thumb_url")
    val thumbURL: String,

    val width: Long? = null
)

@Serializable
data class StepMade (
    val id: String,
    val task: TaskInProject? = null
)

@Serializable
data class Subscription (
    @SerialName("actor_id")
    val actorID: String,

    @SerialName("created_at")
    val createdAt: String,

    @SerialName("deleted_at")
    val deletedAt: String? = null,

    val id: String,

    @SerialName("object_id")
    val objectID: String,

    @SerialName("object_type")
    val objectType: ObjectType,

    @SerialName("updated_at")
    val updatedAt: String,

    @SerialName("workspace_id")
    val workspaceID: String
)

@Serializable
enum class ObjectType(val value: String) {
    @SerialName("conversation") Conversation("conversation"),
    @SerialName("file") File("file"),
    @SerialName("post") Post("post"),
    @SerialName("task") Task("task");
}

@Serializable
data class Task (
    @SerialName("assignee_id")
    val assigneeID: String? = null,

    @SerialName("assignee_ids")
    val assigneeIDS: List<String>,

    @SerialName("author_id")
    val authorID: String,

    val body: JsonObject? = null,

    @SerialName("completed_at")
    val completedAt: String? = null,

    @SerialName("created_at")
    val createdAt: String,

    @SerialName("decided_at")
    val decidedAt: String,

    @SerialName("deleted_at")
    val deletedAt: String? = null,

    @SerialName("due_on")
    val dueOn: LocalDate? = null,

    @SerialName("ends_at")
    val endsAt: String? = null,

    val id: String,

    @SerialName("list_id")
    val listID: String? = null,

    val number: Long,

    @SerialName("parent_id")
    val parentID: String? = null,

    val priority: Priority? = null,

    @SerialName("project_id")
    val projectID: String,

    val repeat: Repeat? = null,

    @SerialName("repeat_next_id")
    val repeatNextID: String? = null,

    @SerialName("sort_key")
    val sortKey: String,

    @SerialName("starts_at")
    val startsAt: String? = null,

    val title: String,

    @SerialName("updated_at")
    val updatedAt: String,

    @SerialName("workspace_id")
    val workspaceID: String
)

@Serializable
enum class Priority(val value: String) {
    @SerialName("high") High("high"),
    @SerialName("low") Low("low"),
    @SerialName("medium") Medium("medium"),
    @SerialName("urgent") Urgent("urgent");
}

@Serializable
data class TaskCard (
    val card: TaskCardFace
)

@Serializable
data class TaskCardFace (
    @SerialName("assignee_avatar_url")
    val assigneeAvatarURL: String? = null,

    @SerialName("assignee_id")
    val assigneeID: String? = null,

    @SerialName("assignee_name")
    val assigneeName: String? = null,

    val assignees: List<Assignee>,

    @SerialName("completed_at")
    val completedAt: String? = null,

    @SerialName("created_at")
    val createdAt: String,

    @SerialName("cycle_name")
    val cycleName: String? = null,

    @SerialName("decided_at")
    val decidedAt: String? = null,

    @SerialName("due_on")
    val dueOn: String? = null,

    val id: String,
    val labels: List<Label>,

    @SerialName("list_color")
    val listColor: String? = null,

    @SerialName("list_icon")
    val listIcon: String? = null,

    @SerialName("list_name")
    val listName: String? = null,

    val number: Double,
    val priority: String? = null,

    @SerialName("project_id")
    val projectID: String,

    @SerialName("project_key")
    val projectKey: String? = null,

    @SerialName("project_name")
    val projectName: String? = null,

    @SerialName("project_slug")
    val projectSlug: String? = null,

    val repeat: Repeat? = null,
    val title: String
)

@Serializable
data class Assignee (
    @SerialName("avatar_url")
    val avatarURL: String? = null,

    val id: String,
    val name: String
)

@Serializable
data class Label (
    val color: String? = null,
    val id: String,
    val name: String
)

@Serializable
data class TaskChanged (
    val next: TaskInProject? = null,

    @SerialName("next_parts")
    val nextParts: List<TaskInProject>? = null,

    val ok: Boolean,
    val parts: List<TaskInProject>? = null,
    val repeat: Repeat? = null,
    val rewaits: List<Rewait>? = null,

    @SerialName("sort_key")
    val sortKey: String? = null,

    val task: TaskInProject? = null,
    val withdrawn: String? = null
)

@Serializable
data class TaskCopied (
    @SerialName("assignees_dropped")
    val assigneesDropped: List<AssigneesDropped>,

    val cycle: String? = null,
    val files: Long,

    @SerialName("from_project_id")
    val fromProjectID: String,

    @SerialName("github_to")
    val githubTo: Boolean,

    val id: String? = null,

    @SerialName("labels_dropped")
    val labelsDropped: List<String>,

    @SerialName("labels_kept")
    val labelsKept: List<String>,

    @SerialName("list_id")
    val listID: String? = null,

    @SerialName("list_name")
    val listName: String? = null,

    val number: Long? = null,

    @SerialName("project_id")
    val projectID: String,

    val subtasks: Long,
    val tasks: List<TaskInProject>? = null
)

@Serializable
data class AssigneesDropped (
    @SerialName("actor_id")
    val actorID: String,

    val name: String
)

@Serializable
data class TaskDeleted (
    val next: TaskInProject? = null,

    @SerialName("next_parts")
    val nextParts: List<TaskInProject>? = null,

    val ok: Boolean
)

@Serializable
data class TaskDuplicated (
    val id: String,
    val tasks: List<TaskInProject>? = null
)

@Serializable
data class TaskInDetail (
    val ancestors: List<Ancestor>? = null,

    @SerialName("assignee_id")
    val assigneeID: String? = null,

    @SerialName("assignee_ids")
    val assigneeIDS: List<String>,

    @SerialName("author_id")
    val authorID: String,

    @SerialName("author_name")
    val authorName: String? = null,

    @SerialName("blocked_by")
    val blockedBy: List<TaskRelated>? = null,

    val blocks: List<TaskRelated>? = null,
    val body: JsonObject? = null,

    @SerialName("completed_at")
    val completedAt: String? = null,

    @SerialName("created_at")
    val createdAt: String? = null,

    @SerialName("cycle_id")
    val cycleID: String? = null,

    @SerialName("decided_at")
    val decidedAt: String? = null,

    @SerialName("deleted_at")
    val deletedAt: String? = null,

    @SerialName("due_on")
    val dueOn: LocalDate? = null,

    @SerialName("ends_at")
    val endsAt: String? = null,

    val id: String,
    val labels: List<LabelOnTask>? = null,

    @SerialName("list_id")
    val listID: String? = null,

    @SerialName("my_reminder")
    val myReminder: TaskReminder? = null,

    val number: Long,

    @SerialName("parent_id")
    val parentID: String? = null,

    val priority: String? = null,

    @SerialName("project_id")
    val projectID: String,

    val repeat: Repeat? = null,

    @SerialName("repeat_next_id")
    val repeatNextID: String? = null,

    @SerialName("sort_key")
    val sortKey: String,

    @SerialName("starts_at")
    val startsAt: String? = null,

    val subscribed: Boolean? = null,
    val title: String,

    @SerialName("updated_at")
    val updatedAt: String? = null,

    @SerialName("workspace_id")
    val workspaceID: String? = null
)

@Serializable
data class Ancestor (
    val id: String,
    val number: Long? = null,
    val title: String
)

@Serializable
data class TaskReminder (
    val at: String
)

@Serializable
data class TaskInList (
    @SerialName("assignee_id")
    val assigneeID: String? = null,

    @SerialName("assignee_ids")
    val assigneeIDS: List<String>,

    @SerialName("author_avatar_url")
    val authorAvatarURL: String? = null,

    @SerialName("author_id")
    val authorID: String,

    @SerialName("author_name")
    val authorName: String? = null,

    val body: JsonObject? = null,

    @SerialName("completed_at")
    val completedAt: String? = null,

    @SerialName("created_at")
    val createdAt: String? = null,

    @SerialName("decided_at")
    val decidedAt: String,

    @SerialName("deleted_at")
    val deletedAt: String? = null,

    @SerialName("due_on")
    val dueOn: LocalDate? = null,

    @SerialName("ends_at")
    val endsAt: String? = null,

    val id: String,

    @SerialName("list_id")
    val listID: String? = null,

    val number: Long,

    @SerialName("parent_id")
    val parentID: String? = null,

    val priority: Priority? = null,

    @SerialName("project_id")
    val projectID: String,

    val repeat: Repeat? = null,

    @SerialName("repeat_next_id")
    val repeatNextID: String? = null,

    @SerialName("sort_key")
    val sortKey: String,

    @SerialName("starts_at")
    val startsAt: String? = null,

    val title: String,

    @SerialName("updated_at")
    val updatedAt: String? = null,

    @SerialName("workspace_id")
    val workspaceID: String? = null
)

@Serializable
data class TaskList (
    @SerialName("agent_id")
    val agentID: String? = null,

    @SerialName("author_id")
    val authorID: String,

    val color: Color? = null,

    @SerialName("created_at")
    val createdAt: String,

    @SerialName("deleted_at")
    val deletedAt: String? = null,

    val finishes: Boolean,
    val icon: Icon,
    val id: String,
    val intake: Boolean? = null,
    val name: String,
    val narrow: Boolean,
    val progress: Double? = null,

    @SerialName("project_id")
    val projectID: String,

    @SerialName("sort_key")
    val sortKey: String,

    @SerialName("updated_at")
    val updatedAt: String,

    @SerialName("workspace_id")
    val workspaceID: String
)

@Serializable
enum class Color(val value: String) {
    @SerialName("blue") Blue("blue"),
    @SerialName("green") Green("green"),
    @SerialName("grey") Grey("grey"),
    @SerialName("indigo") Indigo("indigo"),
    @SerialName("orange") Orange("orange"),
    @SerialName("pink") Pink("pink"),
    @SerialName("purple") Purple("purple"),
    @SerialName("red") Red("red"),
    @SerialName("teal") Teal("teal"),
    @SerialName("yellow") Yellow("yellow");
}

@Serializable
enum class Icon(val value: String) {
    @SerialName("backlog") Backlog("backlog"),
    @SerialName("doing") Doing("doing"),
    @SerialName("done") Done("done"),
    @SerialName("open") Open("open"),
    @SerialName("review") Review("review"),
    @SerialName("started") Started("started"),
    @SerialName("stopped") Stopped("stopped");
}

@Serializable
data class TaskPage (
    val lists: List<ListPage>? = null,

    @SerialName("next_cursor")
    val nextCursor: String? = null,

    val tasks: List<TaskInProject>,
    val total: Long? = null
)

@Serializable
data class TaskPrompt (
    val text: String
)

@Serializable
data class TaskRead (
    val comments: List<CommentOnObject>? = null,

    @SerialName("comments_earlier")
    val commentsEarlier: String? = null,

    val displays: Map<String, String>? = null,
    val feedback: Feedback? = null,
    val files: Map<String, String>? = null,
    val github: Github? = null,
    val sizes: Map<String, Double>? = null,
    val spend: List<SpendOnTask>? = null,
    val steps: List<Step>? = null,
    val task: TaskInDetail,
    val time: List<TimeOnObject>? = null,
    val working: List<AgentStatus>? = null
)

@Serializable
data class Feedback (
    val email: String? = null
)

@Serializable
data class Github (
    val issue: Issue? = null,
    val pulls: List<PullOnTask>
)

@Serializable
data class Issue (
    val number: Long,

    @SerialName("repo_name")
    val repoName: String,

    val url: String
)

@Serializable
data class TimeOnObject (
    @SerialName("actor_id")
    val actorID: String,

    @SerialName("actor_name")
    val actorName: String? = null,

    val id: String,
    val minutes: Long,
    val note: String? = null,

    @SerialName("spent_on")
    val spentOn: String
)

@Serializable
data class TaskReminderSet (
    val reminder: TaskReminder
)

@Serializable
data class TasksImported (
    val written: Long
)

@Serializable
data class TemplateChanged (
    val ok: Boolean,

    @SerialName("template_at")
    val templateAt: String? = null
)

@Serializable
data class TokenMade (
    val token: String
)

@Serializable
data class TokenRow (
    @SerialName("created_at")
    val createdAt: String,

    @SerialName("expires_at")
    val expiresAt: String? = null,

    val id: String,

    @SerialName("last_used_at")
    val lastUsedAt: String? = null,

    val name: String,

    @SerialName("project_ids")
    val projectIDS: List<String>? = null,

    @SerialName("revoked_at")
    val revokedAt: String? = null
)

@Serializable
data class Tokens (
    val tokens: List<TokenRow>
)

@Serializable
data class TwoFactor (
    val enabled: Boolean,
    val proof: Proof? = null,

    @SerialName("recovery_left")
    val recoveryLeft: Long? = null
)

@Serializable
enum class Proof(val value: String) {
    @SerialName("email") Email("email"),
    @SerialName("password") Password("password");
}

@Serializable
data class TwoFactorBegun (
    val secret: String,
    val url: String
)

@Serializable
data class UnconfirmedAnswered (
    @SerialName("access_token")
    val accessToken: String? = null,

    @SerialName("actor_id")
    val actorID: String? = null,

    val answer: Answer,

    @SerialName("expires_in")
    val expiresIn: Long? = null,

    val ok: Boolean,

    @SerialName("refresh_token")
    val refreshToken: String? = null,

    @SerialName("workspace_id")
    val workspaceID: String? = null
)

@Serializable
enum class Answer(val value: String) {
    @SerialName("joined") Joined("joined"),
    @SerialName("left") Left("left");
}

@Serializable
data class UnconfirmedWorkspaces (
    val waiting: List<Waiting>
)

@Serializable
data class Waiting (
    val id: String,
    val name: String,
    val role: Role
)

@Serializable
data class User (
    @SerialName("actor_id")
    val actorID: String,

    @SerialName("created_at")
    val createdAt: String,

    val email: String,

    @SerialName("email_verified_at")
    val emailVerifiedAt: String? = null,

    @SerialName("totp_enabled")
    val totpEnabled: Boolean,

    @SerialName("updated_at")
    val updatedAt: String
)

@Serializable
data class Verified (
    @SerialName("access_token")
    val accessToken: String? = null,

    @SerialName("actor_id")
    val actorID: String? = null,

    val approved: Boolean? = null,
    val changed: Boolean? = null,

    @SerialName("choose_password")
    val choosePassword: String? = null,

    val confirmed: Boolean? = null,
    val email: String? = null,

    @SerialName("expires_in")
    val expiresIn: Long? = null,

    @SerialName("refresh_token")
    val refreshToken: String? = null,

    @SerialName("workspace_id")
    val workspaceID: String? = null
)

@Serializable
data class WaitingInvitations (
    val invitations: List<Invitation>
)

@Serializable
data class Invitation (
    val host: String? = null,
    val id: String,

    @SerialName("workspace_name")
    val workspaceName: String
)

@Serializable
data class WayIn (
    @SerialName("created_at")
    val createdAt: String,

    val email: String? = null,
    val id: String,
    val provider: Provider
)

@Serializable
enum class Provider(val value: String) {
    @SerialName("apple") Apple("apple"),
    @SerialName("github") Github("github"),
    @SerialName("google") Google("google"),
    @SerialName("oidc") Oidc("oidc");
}

@Serializable
data class WayInAdded (
    val email: String? = null,
    val provider: Provider
)

@Serializable
data class WayInStart (
    val url: String
)

@Serializable
data class WaysIn (
    val asks: AsksEnum,
    val offered: List<Provider>,

    @SerialName("oidc_name")
    val oidcName: String? = null,

    val password: Boolean,
    val ways: List<WayIn>
)

@Serializable
enum class AsksEnum(val value: String) {
    @SerialName("email") Email("email"),
    @SerialName("password") Password("password"),
    @SerialName("password_and_code") PasswordAndCode("password_and_code");
}

@Serializable
data class WebhookChanged (
    val ok: Boolean,
    val secret: String? = null
)

@Serializable
data class WebhookMade (
    val id: String,
    val secret: String
)

@Serializable
data class WebhookRow (
    @SerialName("authorization_set")
    val authorizationSet: Boolean? = null,

    @SerialName("created_at")
    val createdAt: String,

    val enabled: Boolean,
    val events: List<String>,
    val id: String,

    @SerialName("last_at")
    val lastAt: String? = null,

    @SerialName("last_status")
    val lastStatus: Long? = null,

    @SerialName("stopped_at")
    val stoppedAt: String? = null,

    val url: String
)

@Serializable
data class Webhooks (
    val webhooks: List<WebhookRow>
)

@Serializable
data class WorkspaceClass (
    @SerialName("created_at")
    val createdAt: String,

    @SerialName("deleted_at")
    val deletedAt: String? = null,

    val id: String,
    val limits: JsonObject,
    val name: String,
    val plan: String,
    val settings: WorkspaceSettings,
    val slug: String,

    @SerialName("updated_at")
    val updatedAt: String,

    @SerialName("workspace_id")
    val workspaceID: String
)

@Serializable
data class WorkspaceSettings (
    @SerialName("edit_others_content")
    val editOthersContent: EditOthersContent? = null,

    @SerialName("who_creates_projects")
    val whoCreatesProjects: Who? = null,

    @SerialName("who_invites_people")
    val whoInvitesPeople: Who? = null,

    @SerialName("who_sees_members")
    val whoSeesMembers: Who? = null
)

@Serializable
data class WorkspaceAddress (
    val free: Boolean,
    val slug: String,
    val suggestion: String? = null
)

@Serializable
data class WorkspaceErasing (
    val agents: Long,
    val asks: String,
    val name: String,
    val paid: Boolean,
    val people: Long,
    val projects: Long
)

@Serializable
data class WorkspaceImport (
    @SerialName("created_at")
    val createdAt: String,

    val error: String? = null,

    @SerialName("finished_at")
    val finishedAt: String? = null,

    val id: String,
    val progress: Map<String, ImportProgress>,
    val source: WorkspaceImportSource,
    val state: State,
    val teams: List<ImportTeam>
)

@Serializable
enum class WorkspaceImportSource(val value: String) {
    @SerialName("asana") Asana("asana"),
    @SerialName("jira") Jira("jira"),
    @SerialName("linear") Linear("linear");
}

@Serializable
enum class State(val value: String) {
    @SerialName("done") Done("done"),
    @SerialName("failed") Failed("failed"),
    @SerialName("running") Running("running");
}

@Serializable
data class WorkspaceImports (
    val imports: List<WorkspaceImport>
)

@Serializable
data class WorkspaceInList (
    @SerialName("icon_url")
    val iconURL: String? = null,

    val id: String,

    @SerialName("mark_icon")
    val markIcon: String? = null,

    @SerialName("mark_tint")
    val markTint: Long? = null,

    val name: String,
    val plan: String? = null,
    val role: String,
    val slug: String,
    val unread: Boolean? = null
)

@Serializable
data class WorkspaceList (
    val current: String? = null,
    val workspaces: List<WorkspaceInList>
)

@Serializable
data class WorkspaceMade (
    @SerialName("access_token")
    val accessToken: String,

    @SerialName("actor_id")
    val actorID: String,

    @SerialName("expires_in")
    val expiresIn: Long,

    @SerialName("refresh_token")
    val refreshToken: String,

    val slug: String,

    @SerialName("workspace_id")
    val workspaceID: String
)

/** A count as the server answers it — a number, or the string Postgres's `count(*)` arrives as. */
@Serializable(with = CountSerializer::class)
@JvmInline
value class Count(val value: Double) {
    val int: Int get() = value.toInt()
}

/** A count that may not have been kept: the same count, on a field that is nullable already. */
typealias CountOrNone = Count

object CountSerializer : KSerializer<Count> {
    override val descriptor: SerialDescriptor = PrimitiveSerialDescriptor("Count", PrimitiveKind.DOUBLE)
    override fun deserialize(decoder: Decoder): Count {
        val primitive = (decoder as JsonDecoder).decodeJsonElement().jsonPrimitive
        return Count(primitive.doubleOrNull ?: primitive.content.toDoubleOrNull() ?: 0.0)
    }
    override fun serialize(encoder: Encoder, value: Count) = encoder.encodeDouble(value.value)
}

object LocalDateSerializer : KSerializer<LocalDate> {
    override val descriptor: SerialDescriptor = PrimitiveSerialDescriptor("LocalDate", PrimitiveKind.STRING)
    override fun deserialize(decoder: Decoder): LocalDate = LocalDate.parse(decoder.decodeString())
    override fun serialize(encoder: Encoder, value: LocalDate) {
        encoder.encodeString(java.time.format.DateTimeFormatter.ISO_LOCAL_DATE.format(value))
    }
}

