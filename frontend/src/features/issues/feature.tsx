import "./issues.css";
import { sectionRows } from "../../shared/api/operations";
import Icon from "../../shared/components/Icon";
import type { AdminTabProps, FeatureDataProps, FeatureDefinition } from "../../shared/feature";
import { SectionAdmin } from "../../shared/sections/SectionEditor";
import { addAdminComment } from "./api";
import CommentsAdmin from "./CommentsAdmin";
import { IssueCards } from "./IssueCards";
import IssuesPage from "./IssuesPage";
import { issueSection } from "./section";

function HomePreview({ snapshot }: FeatureDataProps) {
  return (
    <div className="issue-preview">
      <Icon name="flag" size={38} />
      <div>
        <span>Regional issues</span>
        <strong>{sectionRows(snapshot, "issues").length} <small>issues</small></strong>
        <span>이슈 · 조치 · 담당자</span>
      </div>
    </div>
  );
}

/** DB 관리 > 리전 이슈: 편집 전에는 카드로 보여 주고, 관리자 댓글은 동시 수정 버전을 확인해 등록합니다. */
function IssuesAdmin(props: AdminTabProps) {
  const { data, snapshot, onChanged } = props;
  return (
    <SectionAdmin
      config={issueSection}
      {...props}
      renderView={(rows) => (
        <IssueCards
          rows={rows}
          data={data}
          onComment={async (id, content) => {
            await addAdminComment(snapshot.revision, id, content);
            await onChanged();
          }}
        />
      )}
    />
  );
}

const feature: FeatureDefinition = {
  id: "issues",
  label: "리전 이슈",
  icon: "flag",
  order: 50,
  english: "ISSUES & ACTIONS",
  description: "리전별 운영 이슈와 조치 내용, 댓글을 확인하세요.",
  homeCount: (snapshot) => `${sectionRows(snapshot, "issues").length}개 이슈`,
  featured: { order: 3, Preview: HomePreview },
  report: {
    order: 3,
    Summary: ({ data, snapshot }) => (
      <IssuesPage rows={sectionRows(snapshot, "issues")} data={data} month={snapshot.month} rowLimit={15} />
    ),
  },
  admin: [
    { id: "issues", label: "리전 이슈", Editor: IssuesAdmin },
    { id: "comments", label: "이슈 댓글", Editor: CommentsAdmin },
  ],
  Page: ({ data, snapshot, user, refresh }) => (
    <>
      <span className="eyebrow">{"ISSUES & ACTIONS"}</span>
      <IssuesPage
        rows={sectionRows(snapshot, "issues")}
        data={data}
        month={snapshot.month}
        canWrite={Boolean(user) && user?.role !== "observer"}
        onChanged={refresh}
      />
    </>
  ),
};

export default feature;
