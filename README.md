# SkillGrid

This is the project repository for **SkillGrid**, built
for UCS503P Software Engineering Project (2026-27 ODD),
following the [course project
template](https://github.com/tiet-ucs503/ucs503p-202627odd-template).

There are 3 reports in LaTeX format, namely *a*)
Project Proposal, *b*) Project Report Prototype Stage,
and *c*) Project Report Final -- each in their
respective folders.

Journals are stacked under the folder `journals`, one
folder for each team member.

The source code is contained within the folder `code`.

The documentation is under folder `docs`.

## Docs

The `docs` folder is an organised collection of markdown
(`md`) files, built using
[`mkdocs`](https://www.mkdocs.org/). Any commit into the
`main` branch of the github repository triggers a CI/CD
based build and deployment of the documentation,
including the journals.

For a local DEV-version of the docs for viewing and
testing, install the local env and issue the following
command:

``` shell
make docs
```
