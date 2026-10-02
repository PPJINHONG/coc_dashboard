지금 구조라면 **복잡한 GitFlow보다 “GitHub Flow + GitHub Actions + Docker + ECR + EC2 + Terraform”** 조합으로 가는 게 가장 좋습니다. 2명 규모에 맞게 단순하게 시작하되, DevOps 엔지니어 입장에서 포트폴리오로도 의미 있는 기술들을 넣는 방향입니다.

### 전체 흐름

```text
개발자 A Local                 개발자 B Local
    │                              │
feature/user-login             feature/file-upload
    │                              │
    └──────── GitHub Push ─────────┘
                    │
                 Pull Request
                    │
            GitHub Actions - CI
            ├─ Lint
            ├─ Test
            ├─ Build
            └─ Security Scan
                    │
                 Review
                    │
              main Merge
                    │
            GitHub Actions - CD
                    │
             Docker Image Build
                    │
                   ECR
                    │
             AWS EC2 Deploy
                    │
               Health Check
                    │
             CloudWatch Monitoring
```

## 1. 형상관리 방식

2명이니까 `develop`, `release`, `hotfix` 같은 브랜치를 잔뜩 만드는 **GitFlow까지 갈 필요는 없습니다.**

그냥:

```text
main
 ├─ feature/login
 ├─ feature/file-upload
 ├─ feature/admin-page
 └─ fix/login-error
```

이렇게 갑니다.

중요한 건 **사람별 브랜치가 아니라 기능별 브랜치**라는 겁니다.

예를 들어:

```text
박진홍 → feature/user-login
팀원   → feature/dashboard
```

개발 완료하면:

```text
feature/*
    ↓
Pull Request
    ↓
CI 검사
    ↓
상대방 코드 리뷰
    ↓
main merge
```

`main`에는 직접 Push 못 하게 막는 걸 권장합니다. GitHub Branch Protection으로 PR 리뷰, CI 통과 등을 merge 조건으로 걸 수 있습니다. :chatgpt-content-reference{index="0"}

그리고 merge 방식은 **Squash Merge**가 처음에는 제일 관리하기 편합니다.

---

## 2. GitHub Actions는 CI와 CD를 분리

처음부터 개념적으로 두 개로 나누는 걸 추천합니다.

```text
CI
PR 생성
 ↓
코드 검사
 ↓
테스트
 ↓
Docker Build 확인
 ↓
통과하면 Merge 가능
```

그리고:

```text
CD
main Merge
 ↓
Docker Image 생성
 ↓
ECR Push
 ↓
EC2 배포
 ↓
Health Check
```

즉,

**CI = 이 코드 합쳐도 되나?**

**CD = 검증된 코드를 서버에 어떻게 배포할까?**

이렇게 보면 됩니다.

---

## 3. 애플리케이션은 Docker로 통일

이건 꼭 넣는 걸 추천합니다.

예를 들어 지금 생각하고 있는 게

```text
React
Django
MySQL
```

이라면 개발자 PC에 직접 이것저것 설치해서 맞추기보다는:

```text
docker compose up
```

하면 동일한 개발환경이 뜨게 만드는 겁니다.

```text
frontend
React Container

backend
Django Container

db
MySQL Container
```

그러면 Windows 개발자든 Mac 개발자든 환경 차이를 크게 줄일 수 있습니다.

DevOps 관점에서도:

**Docker → Compose → ECR → EC2**

흐름을 직접 구축해 보는 게 상당히 좋습니다.

---

## 4. EC2에는 Git Clone해서 배포하지 않는 방향

초기 프로젝트에서 흔히:

```text
GitHub
 ↓
EC2
 ↓
git pull
 ↓
python manage.py ...
npm ...
```

이렇게 하는데 가능하면 피하는 걸 권합니다.

대신:

```text
GitHub Actions

Docker Image Build
 ↓
AWS ECR
 ↓
image:v1.0.3

EC2
 ↓
docker pull image:v1.0.3
 ↓
Container 교체
```

형태로 갑니다.

그러면 배포 단위가 **소스코드가 아니라 Docker Image**가 됩니다.

이게 나중에 롤백할 때도 좋습니다.

```text
현재
app:v1.0.4

장애 발생
 ↓

app:v1.0.3

재배포
```

하면 됩니다.

---

## 5. AWS 인증은 Access Key 대신 OIDC

이것도 DevOps 관점에서 꼭 해보는 걸 추천합니다.

옛날 방식:

```text
GitHub Secrets

AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
```

보다는:

```text
GitHub Actions
      ↓
     OIDC
      ↓
AWS IAM Role Assume
      ↓
ECR / EC2 접근
```

으로 구성하세요.

GitHub 공식 문서에서도 GitHub Actions와 AWS를 OIDC로 연결하면 장기간 사용하는 AWS Access Key를 GitHub Secret에 저장하지 않아도 됩니다. :chatgpt-content-reference{index="1"}

이건 실제 회사 CI/CD 구축에서도 많이 쓰이는 방식이라 해볼 가치가 큽니다.

---

## 6. 인프라는 Terraform

여기까지 넣으면 프로젝트가 꽤 DevOps스럽게 됩니다.

AWS Console에서:

```text
EC2 클릭
SG 클릭
ECR 클릭
ALB 클릭
IAM 클릭
```

하지 말고 가능하면:

```text
infra/
 ├─ main.tf
 ├─ ec2.tf
 ├─ alb.tf
 ├─ security_group.tf
 ├─ ecr.tf
 └─ iam.tf
```

식으로 관리합니다.

전체적으로:

```text
Application
 └─ GitHub

Infrastructure
 └─ Terraform
```

으로 관리하는 겁니다.

이미 CloudFormation 경험이 있다면 이번 프로젝트에서는 **Terraform을 써보는 걸 특히 추천**합니다. 둘 다 경험하게 되니까 좋습니다.

---

## 7. AWS 구성은 처음에는 이 정도

처음부터 EKS 같은 거 넣지 마세요.

```text
Internet / 사내망
        │
       ALB
        │
       EC2
        │
   Docker Compose
    ├─ React
    └─ Django

MySQL
 └─ RDS

Docker Image
 └─ ECR

Logs / Metric
 └─ CloudWatch

Secrets
 └─ SSM Parameter Store
    또는 Secrets Manager
```

이 정도면 충분합니다.

**Kubernetes는 현재 규모에서는 기술을 위한 기술이 될 가능성이 큽니다.**

나중에 서비스가 커지면:

```text
EC2 + Docker
     ↓
ECS
     ↓
필요하면 EKS
```

정도로 확장하는 게 자연스럽습니다.

---

## 8. 배포 환경은 하나 더 두는 걸 추천

패치를 자주 할 거라면 바로 Production으로 꽂지 말고:

```text
Local
 ↓
PR
 ↓
CI
 ↓
main merge
 ↓
Staging 자동 배포
 ↓
확인
 ↓
Production 배포
```

구조를 추천합니다.

나중에는 GitHub Actions에서:

```text
merge main
→ staging 자동 배포

Release / workflow_dispatch
→ production 배포
```

정도로 만들면 됩니다.

Production은 GitHub Environment의 Approval을 넣어도 좋습니다.

---

# 그래서 지금 너희가 만들 구조

결국 저는 이렇게 잡겠습니다.

```text
                     GitHub
                       │
         ┌─────────────┴─────────────┐
         │                           │
 feature/*                     feature/*
 개발자 A                       개발자 B
         │                           │
         └────────── PR ─────────────┘
                       │
                GitHub Actions
                       │
           Lint / Test / Build
                       │
                    Review
                       │
                     main
                       │
                GitHub Actions
                       │
               Docker Build
                       │
                Security Scan
                       │
                      ECR
                       │
                AWS OIDC/IAM
                       │
                  EC2 Deploy
                       │
                 Health Check
                       │
                  CloudWatch
```

그리고 인프라는 별도로:

```text
Terraform
   │
   ├─ VPC
   ├─ Security Group
   ├─ ALB
   ├─ EC2
   ├─ ECR
   ├─ RDS
   ├─ IAM
   └─ CloudWatch
```

이렇게 관리합니다.

### 배우면서 적용할 기술 우선순위

**1단계 — 제일 먼저**

`Git → GitHub Branch/PR → Branch Protection → GitHub Actions CI`

**2단계**

`Docker → Docker Compose`

**3단계**

`GitHub Actions → ECR → EC2 자동배포`

**4단계**

`GitHub OIDC → AWS IAM`

**5단계**

`Terraform으로 AWS IaC`

**6단계**

`CloudWatch + Health Check + Rollback`

**7단계**

`Trivy / Dependabot 같은 보안·취약점 관리`

이 정도까지만 구현해도 단순히 **“React/Django 사이트를 만들어 AWS에 띄웠다”**가 아니라,

> GitHub 기반 협업 개발 환경을 구축하고, PR/CI 검증 체계와 Docker 기반 배포 표준화, GitHub Actions CI/CD, ECR 이미지 관리, OIDC 기반 AWS 인증, Terraform IaC 및 모니터링/롤백 체계를 구축

이라고 경력기술서에 적을 만한 프로젝트가 됩니다.

특히 **지금 당장 순서로는 `① GitHub 브랜치/PR 규칙 → ② 프로젝트 디렉터리/로컬 Docker 개발환경 → ③ GitHub Actions CI`**까지 먼저 만드는 게 좋습니다. 그다음 AWS 배포로 넘어가면 됩니다.

GitHub를 연결해두면 이후 실제 저장소 구조나 Actions workflow를 같이 보면서 PR/CI 설정을 잡는 데도 활용할 수 있습니다.
