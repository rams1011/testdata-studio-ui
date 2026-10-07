import { useEffect, useMemo, useState } from "react";
import { useNavigate, useOutletContext, useParams } from "react-router-dom";
import { Api } from "../api";
import AuthSettings, { useSpecAuth } from "../components/AuthSettings";
import CaseChangeHistoryModal from "../components/CaseChangeHistoryModal";
import CaseLastRunsModal from "../components/CaseLastRunsModal";
import DuplicateCaseModal from "../components/DuplicateCaseModal";
import RunResultPanel from "../components/RunResultPanel";
import SavedCaseActions from "../components/SavedCaseActions";
import { useToast } from "../components/Toast";
import { caseUpdateFromView, defaultDuplicateName } from "./operationCaseHelpers";

export default function OperationCasesPage({ cases: initialCases }) {
  const { specId, operationKey } = useParams();
  const {
    operations,
    planId,
    reloadCases,
    runEnvironment,
    environmentReady,
    onSpecUpdated,
    onEnvironmentsChanged,
    envEpoch
  } = useOutletContext();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [auth, setAuth] = useSpecAuth(specId);
  const [cases, setCases] = useState(initialCases || []);
  const [running, setRunning] = useState(null);
  const [runResult, setRunResult] = useState(null);
  const [environments, setEnvironments] = useState([]);
  const [duplicateModal, setDuplicateModal] = useState(null);
  const [duplicateSaving, setDuplicateSaving] = useState(false);
  const [lastRunsModal, setLastRunsModal] = useState(null);
  const [changeHistoryModal, setChangeHistoryModal] = useState(null);
  const [runsRefreshKey, setRunsRefreshKey] = useState(0);

  const operation = useMemo(
    () => (operations || []).find((item) => item.key === operationKey),
    [operations, operationKey]
  );

  useEffect(() => {
    setCases(initialCases || []);
  }, [initialCases]);

  useEffect(() => {
    if (!specId) return;
    let cancelled = false;
    Api.listEnvironments(specId)
      .then((list) => {
        if (!cancelled) setEnvironments(list || []);
      })
      .catch(() => {
        if (!cancelled) setEnvironments([]);
      });
    return () => { cancelled = true; };
  }, [specId, envEpoch]);

  async function refreshCases() {
    const all = await reloadCases?.();
    const next = (all || []).filter((item) => item.operationKey === operationKey);
    setCases(next);
    return next;
  }

  async function runSaved(id) {
    setRunning(id);
    try {
      const result = await Api.runCase(id, auth, runEnvironment?.id);
      setRunResult(result);
      setRunsRefreshKey((value) => value + 1);
      toast(result.passed ? "Passed" : (result.error || "Failed"), !result.passed);
    } catch (error) {
      toast(error.message, true);
    } finally {
      setRunning(null);
    }
  }

  async function remove(id) {
    if (!window.confirm(`Delete this case${runEnvironment?.name ? ` from ${runEnvironment.name}` : ""}?`)) {
      return;
    }
    try {
      await Api.deleteCase(id, runEnvironment?.id);
      toast("Test case deleted");
      const next = await refreshCases();
      if (next.length === 1) {
        navigate(`/s/${specId}/op/${encodeURIComponent(operationKey)}/case/${next[0].id}`, { replace: true });
      } else if (!next.length) {
        navigate(`/s/${specId}/op/${encodeURIComponent(operationKey)}`, { replace: true });
      }
    } catch (error) {
      toast(error.message, true);
    }
  }

  function openDuplicateModal(caseItem) {
    if (!caseItem?.id) {
      return;
    }
    setDuplicateModal({
      caseId: caseItem.id,
      sourceTestName: caseItem.testName || "Untitled",
      testName: defaultDuplicateName(caseItem.testName),
      targetEnvironmentId: runEnvironment?.id || environments[0]?.id || "",
      openCopy: true
    });
  }

  async function confirmDuplicate() {
    if (!duplicateModal) {
      return;
    }
    const { caseId, testName, targetEnvironmentId, openCopy } = duplicateModal;
    if (!testName.trim() || !targetEnvironmentId) {
      return;
    }
    setDuplicateSaving(true);
    try {
      let copied = await Api.duplicateCase(caseId, {
        fromEnvironmentId: runEnvironment?.id,
        toEnvironmentId: targetEnvironmentId
      });
      const desiredName = testName.trim();
      if (desiredName !== copied.testName) {
        copied = await Api.updateCase(
          copied.id,
          caseUpdateFromView(copied, { testName: desiredName }, targetEnvironmentId)
        );
      }
      const target = environments.find((item) => item.id === targetEnvironmentId);
      setDuplicateModal(null);
      await refreshCases();
      if (openCopy) {
        if (targetEnvironmentId !== runEnvironment?.id) {
          sessionStorage.setItem(`testdata.env.${specId}`, targetEnvironmentId);
          await Api.applyEnvironment(specId, targetEnvironmentId);
          if (onSpecUpdated) {
            onSpecUpdated(await Api.getSpec(specId));
          }
          onEnvironmentsChanged?.();
        }
        navigate(`/s/${specId}/op/${encodeURIComponent(operationKey)}/case/${copied.id}`);
        toast(target?.name ? `Opened copy in ${target.name}` : "Opened copy");
      } else {
        toast(target?.name && targetEnvironmentId !== runEnvironment?.id
          ? `Created copy in ${target.name}`
          : "Created copy");
      }
    } catch (error) {
      toast(error.message, true);
    } finally {
      setDuplicateSaving(false);
    }
  }

  if (!operation) {
    return <div className="empty">Loading operation…</div>;
  }

  const opPath = `/s/${specId}/op/${encodeURIComponent(operationKey)}`;

  return (
    <div className="op-page">
      <div className="topbar">
        <div>
          <div className="crumb">{operation.tag} · {operation.key}</div>
          <h2 style={{ margin: "4px 0 0" }}>{operation.summary || operation.key}</h2>
          <div className="crumb">
            <span className={`method ${operation.method}`}>{operation.method}</span>
            {" "}
            <code className="case-header-path">{operation.path}</code>
          </div>
        </div>
        <div className="topbar-actions">
          <div className="actions">
            <button
              type="button"
              className="btn primary"
              onClick={() => navigate(`${opPath}/new`)}
            >
              Add test case
            </button>
          </div>
        </div>
      </div>
      {runEnvironment?.name ? (
        <div className="status-banner ok">
          Cases in <strong>{runEnvironment.name}</strong>. Listed cases belong to this environment and plan.
        </div>
      ) : null}
      <AuthSettings
        auth={auth}
        onChange={setAuth}
        specAuth={operation.auth}
        environment={runEnvironment}
      />
      <div className="card saved-case-list" style={{ marginTop: 16 }}>
        <h3>
          {runEnvironment?.name ? `Test cases in ${runEnvironment.name}` : "Test cases for this operation"}
          {" "}
          <span className="hint">({cases.length})</span>
        </h3>
        {!cases.length ? (
          <div className="empty">No cases yet.</div>
        ) : cases.map((item) => (
          <div className="array-item" key={item.id}>
            <div className="array-toolbar">
              <div className="saved-case-meta">
                <strong>{item.testName || "Untitled"}</strong>
                <div className="hint">{item.method} {item.endpoint || operation.path}</div>
              </div>
              <SavedCaseActions
                testName={item.testName}
                running={running === item.id}
                runDisabled={!!running || !environmentReady}
                onRun={() => runSaved(item.id)}
                onEdit={() => navigate(`${opPath}/case/${item.id}`)}
                onDuplicate={() => openDuplicateModal(item)}
                onDelete={() => remove(item.id)}
                onLastRuns={() => setLastRunsModal({ caseId: item.id, testName: item.testName })}
                onChangeHistory={() => setChangeHistoryModal({ caseId: item.id, testName: item.testName })}
              />
            </div>
          </div>
        ))}
      </div>
      <RunResultPanel result={runResult} />
      {lastRunsModal ? (
        <CaseLastRunsModal
          specId={specId}
          planId={planId}
          caseId={lastRunsModal.caseId}
          caseName={lastRunsModal.testName}
          environmentId={runEnvironment?.id}
          environmentReady={environmentReady}
          refreshKey={runsRefreshKey}
          onClose={() => setLastRunsModal(null)}
        />
      ) : null}
      {changeHistoryModal ? (
        <CaseChangeHistoryModal
          caseId={changeHistoryModal.caseId}
          caseName={changeHistoryModal.testName}
          onClose={() => setChangeHistoryModal(null)}
        />
      ) : null}
      {duplicateModal ? (
        <DuplicateCaseModal
          sourceTestName={duplicateModal.sourceTestName}
          testName={duplicateModal.testName}
          onTestNameChange={(testName) => setDuplicateModal((current) => ({ ...current, testName }))}
          targetEnvironmentId={duplicateModal.targetEnvironmentId}
          onTargetEnvironmentChange={(targetEnvironmentId) => (
            setDuplicateModal((current) => ({ ...current, targetEnvironmentId }))
          )}
          environments={environments}
          currentEnvironmentId={runEnvironment?.id}
          openCopy={duplicateModal.openCopy}
          onOpenCopyChange={(openCopy) => setDuplicateModal((current) => ({ ...current, openCopy }))}
          saving={duplicateSaving}
          onConfirm={confirmDuplicate}
          onClose={() => {
            if (!duplicateSaving) {
              setDuplicateModal(null);
            }
          }}
        />
      ) : null}
    </div>
  );
}
