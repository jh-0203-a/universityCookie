// ============================================================
// 댓글 + 대댓글(답글)을 함께 보여주는 공용 컴포넌트입니다.
//  - 커뮤니티 글 / 모임 게시글 / 중고거래 판매글이 모두 같은 모양으로 씁니다.
//  - 답글은 한 단계만 들어갑니다. (답글에 다시 답글을 달면 같은 부모 밑으로 모임)
//  - 좋아요/신고 같은 화면별 버튼은 renderActions 로 끼워 넣어요.
// ============================================================
import {Fragment, useState, type ReactNode} from 'react';
import {CornerDownRight, Trash2} from 'lucide-react';
import type {Comment} from './types';
import {PrimaryButton, VerifiedBadges, inputClass} from './ui';

export function CommentThread({
  comments,
  meNick,
  isAdmin,
  onAdd,
  onDelete,
  renderActions,
}: {
  comments: Comment[];
  meNick: string;
  isAdmin?: boolean;
  onAdd: (body: string, parentId?: number) => void; // parentId 있으면 답글
  onDelete: (commentId: number) => void;
  renderActions?: (c: Comment) => ReactNode; // 좋아요/신고 등 화면별 버튼
}) {
  const [text, setText] = useState(''); // 최상위 댓글 입력칸
  const [replyTo, setReplyTo] = useState<number | null>(null); // 지금 답글 다는 부모 댓글 id
  const [replyText, setReplyText] = useState('');

  const tops = comments.filter((c) => !c.parentId); // 최상위 댓글
  const repliesOf = (id: number) => comments.filter((c) => c.parentId === id); // 그 댓글의 답글들
  const canDelete = (c: Comment) => c.author === meNick || isAdmin;

  function submitTop() {
    if (!text.trim()) return;
    onAdd(text.trim());
    setText('');
  }
  function submitReply(parentId: number) {
    if (!replyText.trim()) return;
    onAdd(replyText.trim(), parentId);
    setReplyText('');
    setReplyTo(null);
  }

  const renderRow = (c: Comment, isReply?: boolean) => {
    // 답글에 답글을 달면 같은 최상위 부모(c.parentId) 밑으로 모읍니다.
    const parentForReply = isReply ? c.parentId! : c.id;
    return (
      <div className={`flex items-start gap-2 rounded-lg p-3 ${isReply ? 'ml-5 bg-gray-100/80' : 'bg-gray-50'}`}>
        <div className="min-w-0 flex-1">
          <p className="flex items-center text-xs text-gray-400">
            {isReply && <CornerDownRight size={12} className="mr-1 text-gray-300" />}
            {c.author}
            <VerifiedBadges nickname={c.author} /> · {c.createdAt}
          </p>
          <p className="text-sm text-gray-800">{c.body}</p>
          <div className="mt-1 flex items-center gap-3">
            {renderActions?.(c)}
            <button
              onClick={() => {
                setReplyTo(replyTo === parentForReply ? null : parentForReply);
                setReplyText('');
              }}
              className="text-xs text-gray-400"
            >
              답글
            </button>
          </div>
        </div>
        {canDelete(c) && (
          <button onClick={() => onDelete(c.id)} className="text-gray-300" aria-label="댓글 삭제">
            <Trash2 size={16} />
          </button>
        )}
      </div>
    );
  };

  return (
    <div>
      <p className="mb-2 text-sm font-semibold text-gray-700">댓글 {comments.length}</p>
      <div className="space-y-2">
        {tops.map((c) => (
          <div key={c.id} className="space-y-1">
            {renderRow(c)}
            {repliesOf(c.id).map((r) => (
              <Fragment key={r.id}>{renderRow(r, true)}</Fragment>
            ))}
            {/* 이 댓글에 답글 달기 입력칸 */}
            {replyTo === c.id && (
              <div className="ml-5 flex gap-2">
                <input
                  className={inputClass}
                  placeholder="답글을 입력하세요"
                  value={replyText}
                  autoFocus
                  onChange={(e) => setReplyText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && submitReply(c.id)}
                />
                <PrimaryButton onClick={() => submitReply(c.id)}>등록</PrimaryButton>
              </div>
            )}
          </div>
        ))}
        {comments.length === 0 && <p className="text-sm text-gray-400">첫 댓글을 남겨보세요.</p>}
      </div>

      {/* 최상위 댓글 입력칸 */}
      <div className="mt-3 flex gap-2">
        <input
          className={inputClass}
          placeholder="댓글을 입력하세요"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submitTop()}
        />
        <PrimaryButton onClick={submitTop}>등록</PrimaryButton>
      </div>
    </div>
  );
}
