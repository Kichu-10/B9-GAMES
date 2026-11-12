@echo off
setlocal enabledelayedexpansion
git status -uall --porcelain > _files.txt
set total=0
for /f "usebackq delims=" %%A in ("_files.txt") do set /a total+=1
set /a extra=total - 50
set count=0
set stage=1
for /f "usebackq delims=" %%A in ("_files.txt") do (
  set "line=%%A"
  set "file=!line:~3!"
  set "file=!file:"=!"
  git add "!file!"
  set /a count+=1
  if !stage! leq !extra! (
    set target=2
  ) else (
    set target=1
  )
  if !count! geq !target! (
    git commit -m "Stage !stage!: update project files"
    set /a stage+=1
    set count=0
  )
)
del _files.txt
