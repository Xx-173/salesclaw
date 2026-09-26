# SalesClaw

<p align="center">
  <img src="web/public/icons/logo-1024.png" alt="SalesClaw logo" width="112" />
</p>

<p align="center">
  <strong>面向团队与多种业务场景的自托管 Agent 平台基座</strong><br />
  按岗位配置 Agent，在统一运行环境中管理工作区、会话、知识、工具、渠道与自动化任务，并提供隔离、权限与审计治理能力。
</p>

<p align="center">
  <a href="https://github.com/Xx-173/salesclaw">GitHub</a> ·
  <a href="docs/API.md">API</a> ·
  <a href="docs/ACL-MATRIX.md">权限模型</a> ·
  <a href="SECURITY.md">安全策略</a>
</p>

## 产品定位

SalesClaw 是通用的自托管 Agent 运行与治理基座，采用智能体优先工作模型。团队可以按业务目标和岗位配置 Agent，并使用长期运行的工作区、会话、知识、工具、渠道与自动化能力构建具体应用。客服、销售、运营等都是可承载的业务场景，不限定于单一行业或岗位。

当前代码库提供的是通用 Agent 运行时与治理能力；接入真实客户数据、消息平台、外发动作或模型服务前，必须由部署方完成授权、验签、最小权限和审计配置。

## 核心能力

- Agent Profile、Workspace、Session、Memory、Skills、MCP 与 Subagent 的隔离管理。
- 基于 Pi Agent Runtime 的流式对话、工具调用、会话恢复和后台任务。
- 多用户认证、角色权限、Workspace ACL、操作审计与安全执行边界。
- Web、Electron Desktop 与可配置消息渠道入口。
- Cron、固定间隔和一次性自动化任务，以及运行历史与通知。
- Host / Docker 双执行模式，支持将 Agent 的能力范围与宿主环境分离。

## 本地启动

要求：Node.js 20+，并按需准备 Docker 与模型/渠道配置。

```bash
npm ci
npm run dev:all
```

浏览器访问本地服务后完成管理员初始化。真实 Provider、渠道和容器运行时均需要由部署者自行配置；请勿将 API Key、Cookie、Token 或客户数据提交到仓库。

常用校验：

```bash
npm run typecheck
npm test -- --run
npm run build:all
```

## 项目结构

```text
src/                    后端、认证、运行时、权限与渠道适配
web/                    Web / PWA 客户端
electron/               Desktop Shell
container/agent-runner/ 隔离的 Agent 运行环境
docs/                   API、安全、权限与运行说明
```

## 部署与安全

- 生产环境使用 HTTPS / WSS，并把密钥放在受管密钥存储或部署环境变量中。
- 将消息渠道、客户数据和外发能力绑定到最小权限的 Workspace 与角色。
- 对销售自动化场景，为频控、停用、人工接管、同意状态和审计留出明确控制点。
- 默认容器镜像为 `ghcr.io/xx-173/salesclaw-agent:latest`；首次使用前请发布或显式指定你自己的 `SALESCLAW_CONTAINER_IMAGE` / `CONTAINER_IMAGE`。

## 许可证

本仓库遵循 MIT License。`LICENSE` 中保留了随源码附带的版权与许可声明；对本项目的新增修改适用同一许可证。
