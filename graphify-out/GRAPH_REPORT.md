# Graph Report - C:\src\diagram-tours  (2026-06-12)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 1605 nodes · 3106 edges · 92 communities (87 shown, 5 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 9 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `a63f354a`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 33|Community 33]]
- [[_COMMUNITY_Community 34|Community 34]]
- [[_COMMUNITY_Community 35|Community 35]]
- [[_COMMUNITY_Community 36|Community 36]]
- [[_COMMUNITY_Community 37|Community 37]]
- [[_COMMUNITY_Community 38|Community 38]]
- [[_COMMUNITY_Community 39|Community 39]]
- [[_COMMUNITY_Community 40|Community 40]]
- [[_COMMUNITY_Community 41|Community 41]]
- [[_COMMUNITY_Community 42|Community 42]]
- [[_COMMUNITY_Community 43|Community 43]]
- [[_COMMUNITY_Community 44|Community 44]]
- [[_COMMUNITY_Community 45|Community 45]]
- [[_COMMUNITY_Community 46|Community 46]]
- [[_COMMUNITY_Community 47|Community 47]]
- [[_COMMUNITY_Community 48|Community 48]]
- [[_COMMUNITY_Community 49|Community 49]]
- [[_COMMUNITY_Community 50|Community 50]]
- [[_COMMUNITY_Community 51|Community 51]]
- [[_COMMUNITY_Community 52|Community 52]]
- [[_COMMUNITY_Community 53|Community 53]]
- [[_COMMUNITY_Community 54|Community 54]]
- [[_COMMUNITY_Community 55|Community 55]]
- [[_COMMUNITY_Community 56|Community 56]]
- [[_COMMUNITY_Community 57|Community 57]]
- [[_COMMUNITY_Community 58|Community 58]]
- [[_COMMUNITY_Community 59|Community 59]]
- [[_COMMUNITY_Community 60|Community 60]]
- [[_COMMUNITY_Community 61|Community 61]]
- [[_COMMUNITY_Community 62|Community 62]]
- [[_COMMUNITY_Community 63|Community 63]]
- [[_COMMUNITY_Community 64|Community 64]]
- [[_COMMUNITY_Community 65|Community 65]]
- [[_COMMUNITY_Community 66|Community 66]]
- [[_COMMUNITY_Community 67|Community 67]]
- [[_COMMUNITY_Community 68|Community 68]]
- [[_COMMUNITY_Community 69|Community 69]]
- [[_COMMUNITY_Community 70|Community 70]]
- [[_COMMUNITY_Community 71|Community 71]]
- [[_COMMUNITY_Community 72|Community 72]]
- [[_COMMUNITY_Community 73|Community 73]]
- [[_COMMUNITY_Community 74|Community 74]]
- [[_COMMUNITY_Community 75|Community 75]]
- [[_COMMUNITY_Community 76|Community 76]]
- [[_COMMUNITY_Community 77|Community 77]]
- [[_COMMUNITY_Community 78|Community 78]]
- [[_COMMUNITY_Community 79|Community 79]]
- [[_COMMUNITY_Community 85|Community 85]]

## God Nodes (most connected - your core abstractions)
1. `normalizePath()` - 29 edges
2. `scripts` - 24 edges
3. `createTourMessage()` - 20 edges
4. `expectDiagramVisible()` - 19 edges
5. `startDevServer()` - 18 edges
6. `loadResolvedTourCollection()` - 17 edges
7. `invariant()` - 16 edges
8. `appendDiagnostic()` - 15 edges
9. `createTourContext()` - 13 edges
10. `renderMermaidDiagram()` - 13 edges

## Surprising Connections (you probably didn't know these)
- `startWebServer()` --calls--> `spawn()`  [INFERRED]
  packages/cli/src/lib/server.ts → scripts/dev-web-player-lib.test.ts
- `parseTourDocument()` --calls--> `parseDocument()`  [INFERRED]
  packages/parser/src/authored-tour-draft.ts → packages/parser/test/load-resolved-tour.test.ts
- `spawnDevServer()` --calls--> `spawn()`  [INFERRED]
  packages/web-player/smoke/dev-server.ts → scripts/dev-web-player-lib.test.ts
- `resolveElement()` --calls--> `invariant()`  [EXTRACTED]
  packages/parser/src/diagram-model.ts → packages/parser/src/tour-context.ts
- `collectSourcePaths()` --calls--> `readdir()`  [INFERRED]
  packages/parser/src/source-path-discovery.ts → packages/parser/test/validation-targets.test.ts

## Import Cycles
- None detected.

## Communities (92 total, 5 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.06
Nodes (91): appendFocusValue(), createAuthoredTourDraftFromFields(), hasMissingDraftFields(), isMatchingMapKey(), isYamlMapNode(), parseTourDocument(), readAuthoredTourDraft(), readAuthoredTourFieldNodes() (+83 more)

### Community 1 - "Community 1"
Cohesion: 0.05
Nodes (67): $lib/diagram-minimap, $lib/diagram-viewport, $lib/diagram-zoom, $lib/focus-group, $lib/mermaid-diagram, $lib/player-state, $lib/tour-step-links, applySvgZoom() (+59 more)

### Community 2 - "Community 2"
Cohesion: 0.05
Nodes (45): spawn(), delay(), ensureServerStillRunning(), expectDevServerToFail(), FailedDevServerStart, includesPrompt(), isServerReady(), PROMPT_MARKERS (+37 more)

### Community 3 - "Community 3"
Cohesion: 0.06
Nodes (54): applyViewportInstruction(), clampScrollTarget(), createDiagramElementSelector(), createFocusInstruction(), createOverviewScrollPosition(), createViewportInstruction(), DiagramNodeRect, DiagramViewportInstruction (+46 more)

### Community 4 - "Community 4"
Cohesion: 0.04
Nodes (46): husky.sh script, description, devDependencies, @changesets/cli, concurrently, eslint, @eslint/js, eslint-plugin-svelte (+38 more)

### Community 5 - "Community 5"
Cohesion: 0.10
Nodes (31): createTourDiagnostic(), createTourDiagnostics(), ErrorWithLocation, formatTourDiagnostic(), formatTourDiagnostics(), hasDiagnostics(), isErrorWithDiagnostics(), normalizeDiagnosticCode() (+23 more)

### Community 6 - "Community 6"
Cohesion: 0.09
Nodes (33): BrowseFolderNode, BrowseTourNode, BrowseTreeNode, BrowseTreeRow, buildBrowseTree(), BuildFolderNode, collectActiveBrowseFolderIds(), compactBrowseNode() (+25 more)

### Community 7 - "Community 7"
Cohesion: 0.08
Nodes (33): countDiagnosticIssues(), createDiagnosticDisplayGroups(), createDiagnosticDisplayIssue(), createDiagnosticReference(), createDiagnosticSummary(), createSummaryWithCode(), DiagnosticDisplayGroup, DiagnosticDisplayIssue (+25 more)

### Community 8 - "Community 8"
Cohesion: 0.09
Nodes (29): assertIntegerPort(), assertPortRange(), assertSingleValidateTarget(), assignInitFlag(), assignInitTarget(), assignPositional(), assignTarget(), createInitialState() (+21 more)

### Community 9 - "Community 9"
Cohesion: 0.12
Nodes (30): assertOverwriteEnabled(), assertWritableFiles(), createEmptyMermaidScaffold(), createEmptyTourYaml(), createMarkdownSelection(), createSiblingDiagramPath(), createSiblingTourPath(), createTourYaml() (+22 more)

### Community 10 - "Community 10"
Cohesion: 0.09
Nodes (30): createClassStatement(), createNodeClass(), extractMarkerId(), FLOWCHART_MARKER_ATTRIBUTES, FlowchartConnectorEndpoint, hasFiniteSvgBounds(), hasFocusedConnectorEndpoint(), hasFocusedConnectorEndpoints() (+22 more)

### Community 11 - "Community 11"
Cohesion: 0.11
Nodes (25): BrowsePaletteItem, BrowsePaletteSection, buildBrowsePaletteSections(), clampPaletteIndex(), createSection(), flattenBrowsePaletteSections(), markUsedSlugs(), matchesBrowsePaletteQuery() (+17 more)

### Community 12 - "Community 12"
Cohesion: 0.12
Nodes (27): args, child, args, child, promptForSourceTarget(), readPromptErrorMessage(), readSourceTargetFromPrompt(), resolveChoiceSourceTarget() (+19 more)

### Community 13 - "Community 13"
Cohesion: 0.11
Nodes (24): getMermaidErrorMessage(), expectAnnotatedFlowchartConnector(), expectAnnotatedSequenceMarker(), expectAnnotatedSequenceMessage(), expectAnnotatedSequenceMessageElements(), expectSvgState(), installFlowchartBoundsOnlyMocks(), installFlowchartGeometryMocks() (+16 more)

### Community 14 - "Community 14"
Cohesion: 0.12
Nodes (25): resolveBrowserOpenPolicy(), CommandHandlerMap, dispatchParsedArgs(), handleInitCommand(), handleSetupCommand(), handleStartupCommand(), handleWizardLaunchError(), isWizardCancellationError() (+17 more)

### Community 15 - "Community 15"
Cohesion: 0.12
Nodes (25): assertWritableTarget(), assertWritableTargets(), canOverwriteTarget(), createAgentDefinitionContent(), createInstructionsContent(), INSTRUCTIONS_CONTENT, isAffirmative(), maybeApproveOverwrite() (+17 more)

### Community 16 - "Community 16"
Cohesion: 0.11
Nodes (26): createArrowhead(), createDiagramElementSelector(), DiagramMinimapArrowhead, DiagramMinimapConnector, DiagramMinimapConnectorSegment, DiagramMinimapGeometry, DiagramMinimapMetrics, DiagramMinimapNodeRect (+18 more)

### Community 17 - "Community 17"
Cohesion: 0.09
Nodes (21): readDiagramMinimapNodeRects(), createElementStub(), createFixture(), createMetrics(), extractNodeSelector(), FakeSvgLineElement, FakeSvgPolylineElement, interpolateConnectorPoint() (+13 more)

### Community 18 - "Community 18"
Cohesion: 0.09
Nodes (16): {
  applyFocusStateMock,
  focusDiagramViewportMock,
  gotoMock,
  renderMermaidDiagramMock,
  toastErrorMock,
}, createDomRect(), createNodePositions(), createScaledNodeRect(), createScrollToForTest(), interpolateConnectorPoint(), interpolateConnectorSegment(), isConnectorBoundaryDistance() (+8 more)

### Community 19 - "Community 19"
Cohesion: 0.16
Nodes (26): appendMarkdownFenceLine(), assertDiagramFragmentAllowed(), assertMarkdownBlocks(), createDiagramSourceId(), createHeadingSlug(), createMarkdownBlock(), createMarkdownBlockAccumulator(), createMarkdownBlockId() (+18 more)

### Community 20 - "Community 20"
Cohesion: 0.12
Nodes (26): createBareEndpoint(), createFlowchartDiagramModel(), extractFlowchartElements(), FLOWCHART_CONNECTOR_SOURCE, FLOWCHART_LINE_START_ID_PATTERN, FLOWCHART_LINK_MARKER_PATTERN, FLOWCHART_LINK_TARGET_PATTERN, FLOWCHART_METADATA_NODE_PATTERN (+18 more)

### Community 21 - "Community 21"
Cohesion: 0.08
Nodes (25): devDependencies, jsdom, @playwright/test, stylelint, stylelint-config-standard, svelte-check, @sveltejs/adapter-node, @sveltejs/kit (+17 more)

### Community 22 - "Community 22"
Cohesion: 0.16
Nodes (19): DEFAULT_SOURCE_TARGET, describeSourceTarget(), getSourceTarget(), getSourceTargetInfo(), readSourceTargetKind(), SourceTargetInfo, load(), EXAMPLES_ROOT (+11 more)

### Community 23 - "Community 23"
Cohesion: 0.14
Nodes (22): handlePromptFailure(), isClosedReadlineError(), isPortNumber(), NO_ANSWERS, readBrowser(), readBrowserSelection(), readChoiceTarget(), readErrorMessage() (+14 more)

### Community 24 - "Community 24"
Cohesion: 0.16
Nodes (24): readDiagnosticLocationKey(), appendSourceIds(), appendValidationIssue(), appendValidationIssues(), appendValidationReport(), createMissingValidationTargetIssue(), createNoValidToursIssue(), createSingleIssueValidationReport() (+16 more)

### Community 25 - "Community 25"
Cohesion: 0.20
Nodes (21): createGeneratedSteps(), createResolvedDiagram(), createGeneratedDiagramTour(), createGeneratedMarkdownCollectionEntries(), createGeneratedMarkdownCollectionEntry(), createGeneratedRawCollectionEntry(), loadGeneratedDiagramTour(), readGeneratedMarkdownBlockSuffix() (+13 more)

### Community 26 - "Community 26"
Cohesion: 0.16
Nodes (19): assertTargetExists(), INIT_FILE_SUFFIXES, isAllowedInitFragment(), isDirectoryPath(), isEmptyInitPath(), isSimpleInitStem(), isSupportedInitTarget(), readExistingInitSourcePath() (+11 more)

### Community 27 - "Community 27"
Cohesion: 0.14
Nodes (16): buildCoverageDashboard(), capitalize(), CoverageDashboardData, CoverageMetricSummary, CoveragePackageSummary, JsonCoverageSummary, JsonSummaryMetric, PACKAGE_NAMES (+8 more)

### Community 28 - "Community 28"
Cohesion: 0.11
Nodes (19): dependencies, @diagram-tour/core, yaml, devDependencies, @types/node, exports, files, import (+11 more)

### Community 29 - "Community 29"
Cohesion: 0.16
Nodes (10): nestedTourCollection, resolvedPaymentsPlatformTour, resolvedTourCollection, singleTourCollection, load(), ResolvedDiagramTour, { pageState }, { afterNavigateMock, gotoMock, pageState, resetNavigationMocks, setPageUrl } (+2 more)

### Community 30 - "Community 30"
Cohesion: 0.16
Nodes (12): handleValidateCommand(), validateValidationTarget(), ParsedValidateArgs, assertTourFilesFound(), runValidateCommand(), validateDirectoryTours(), validateSingleTour(), Write (+4 more)

### Community 31 - "Community 31"
Cohesion: 0.12
Nodes (15): handleVersionCommand(), CliPackageJson, readCliVersion(), readPackageJsonPath(), closeMock, loadResolvedTourCollectionMock, questionMock, resolveServerBindingMock (+7 more)

### Community 32 - "Community 32"
Cohesion: 0.12
Nodes (17): TourDiagnostic, DiagramReference, LoadedAuthoredTour, MarkdownBlock, MarkdownBlockAccumulator, MarkdownBlockIdentity, MarkdownFallback, MarkdownFence (+9 more)

### Community 33 - "Community 33"
Cohesion: 0.12
Nodes (15): bin, diagram-tours, dependencies, @diagram-tour/parser, @diagram-tour/web-player, files, name, private (+7 more)

### Community 34 - "Community 34"
Cohesion: 0.20
Nodes (12): findAvailableSmokePort(), isPortAvailable(), readEphemeralPort(), readPreferredSmokePort(), readProbeLimit(), readWorktreePath(), resolveSmokeServerPort(), SmokePortSeed (+4 more)

### Community 35 - "Community 35"
Cohesion: 0.14
Nodes (12): $lib/browse-favorites, $lib/browse-palette, $lib/browse-recents, $lib/diagnostics, $lib/interaction-context, $lib/source-target, $lib/theme, ../styles/index.css (+4 more)

### Community 36 - "Community 36"
Cohesion: 0.14
Nodes (14): exports, files, import, main, name, private, scripts, build (+6 more)

### Community 37 - "Community 37"
Cohesion: 0.28
Nodes (14): loadGeneratedCollectionEntries(), addOwnedDiagramPaths(), appendAuthoredDiscoveryResults(), appendDiscoveredTourResult(), appendGeneratedDiscoveryResults(), createCollectionEntries(), createDiscoveredCollectionResult(), createDiscoveredTourCollection() (+6 more)

### Community 38 - "Community 38"
Cohesion: 0.16
Nodes (14): createDefaultSvgProjection(), hasProjectionSvgRect(), readClientExtent(), readDiagramMinimapMetrics(), readExtent(), readLinePoint(), readProjectionSvg(), readScaledCoordinate() (+6 more)

### Community 39 - "Community 39"
Cohesion: 0.18
Nodes (14): annotateConnectorMarkerChild(), annotateFlowchartConnectorMarker(), annotateMessageMarker(), annotateSequenceMessageMarker(), annotateSequenceMessageMarkers(), assignConnectorDataset(), cloneMessageMarker(), createMessageMarkerId() (+6 more)

### Community 40 - "Community 40"
Cohesion: 0.23
Nodes (13): clampCoordinate(), clampRectOrigin(), clampRectSize(), createBoundsRect(), createDiagramMinimapGeometry(), createViewportRect(), hasFiniteConnectorSegment(), isCollapsedConnectorSegment() (+5 more)

### Community 41 - "Community 41"
Cohesion: 0.15
Nodes (13): hasSampledGeometryApi(), hasUsablePolylinePoints(), isSvgLineElement(), isSvgPolylineElement(), readFlowchartConnectorPoints(), readLineConnectorPoints(), readLinePoint(), readPolylineConnectorPoints() (+5 more)

### Community 42 - "Community 42"
Cohesion: 0.26
Nodes (9): getDocumentTheme(), getStoredTheme(), getThemeToggleLabel(), isThemeName(), setDocumentTheme(), setStoredTheme(), ThemeDocumentLike, ThemeName (+1 more)

### Community 43 - "Community 43"
Cohesion: 0.15
Nodes (12): compilerOptions, declaration, declarationMap, esModuleInterop, forceConsistentCasingInFileNames, module, moduleResolution, noEmitOnError (+4 more)

### Community 44 - "Community 44"
Cohesion: 0.17
Nodes (11): compilerOptions, baseUrl, module, moduleResolution, paths, types, extends, include (+3 more)

### Community 45 - "Community 45"
Cohesion: 0.20
Nodes (12): annotateConnectorLabels(), createRenderableDiagramSource(), createRenderId(), loadMermaid(), readMermaidDiagramConfig(), readMermaidThemeVariables(), readPrimaryThemeVariables(), readSecondaryThemeVariables() (+4 more)

### Community 46 - "Community 46"
Cohesion: 0.18
Nodes (12): annotateFlowchartConnectors(), annotateFlowchartConnectorsFromDom(), applyFocusState(), ensureFlowchartConnectorsAnnotated(), hasUnannotatedFlowchartConnector(), readFlowchartConnectorElements(), readFlowchartNodeBounds(), readFlowConnectorTargets() (+4 more)

### Community 47 - "Community 47"
Cohesion: 0.18
Nodes (10): compilerOptions, noEmit, outDir, paths, rootDir, extends, include, @diagram-tour/core (+2 more)

### Community 48 - "Community 48"
Cohesion: 0.31
Nodes (7): buildFavoriteBrowseEntries(), FavoriteBrowseEntry, readFavoriteSlugArray(), readStoredFavoriteSlugs(), sortFavoriteSlugs(), toggleFavoriteSlug(), writeStoredFavoriteSlugs()

### Community 49 - "Community 49"
Cohesion: 0.20
Nodes (11): annotateFlowchartElements(), annotateRenderedElements(), annotateSankeyElements(), annotateSankeyRenderedElement(), annotateSequenceElements(), annotateSequenceMessages(), annotateSequenceParticipants(), findSequenceMessageTextIndex() (+3 more)

### Community 50 - "Community 50"
Cohesion: 0.40
Nodes (5): applyFocusAttributes(), clearFocusState(), readFocusGroup(), readFocusState(), setFocusState()

### Community 51 - "Community 51"
Cohesion: 0.29
Nodes (7): isPortAvailable(), readAutomaticBinding(), readEphemeralPort(), readExplicitBinding(), resolveServerBinding(), ServerBinding, servers

### Community 52 - "Community 52"
Cohesion: 0.49
Nodes (6): createIo(), createMultiBlockMarkdown(), createTempRoot(), ORIGINAL_CWD, writeDiagram(), writeMarkdown()

### Community 53 - "Community 53"
Cohesion: 0.18
Nodes (10): compilerOptions, allowJs, checkJs, esModuleInterop, forceConsistentCasingInFileNames, moduleResolution, resolveJsonModule, skipLibCheck (+2 more)

### Community 54 - "Community 54"
Cohesion: 0.20
Nodes (9): access, baseBranch, changelog, commit, fixed, ignore, linked, $schema (+1 more)

### Community 55 - "Community 55"
Cohesion: 0.29
Nodes (6): resolvedPaymentFlowTour, clampStepIndex(), createTourPlayer(), TourPlayer, TourPlayerState, ResolvedTourStep

### Community 56 - "Community 56"
Cohesion: 0.27
Nodes (10): clampScrollTarget(), createMinimapCenterScrollPosition(), createMinimapViewportScrollPosition(), createScrollPosition(), hasStableContentMetrics(), hasStableMetrics(), hasStableMinimapSize(), hasStableViewportMetrics() (+2 more)

### Community 57 - "Community 57"
Cohesion: 0.31
Nodes (9): DIAGRAM_FILE_SUFFIXES, SourcePaths, collectDiagramFilePath(), collectNestedSourcePaths(), collectSourceFilePath(), collectSourcePaths(), mergeSourcePaths(), sortSourcePaths() (+1 more)

### Community 58 - "Community 58"
Cohesion: 0.36
Nodes (7): require, resolveWebPlayerEntry(), delay(), isReady(), StartedServer, startWebServer(), waitForServer()

### Community 59 - "Community 59"
Cohesion: 0.22
Nodes (8): compilerOptions, baseUrl, noEmit, paths, types, extends, include, @diagram-tour/core

### Community 60 - "Community 60"
Cohesion: 0.46
Nodes (5): normalizeRecentSlugs(), readRecentSlugArray(), readStoredRecentSlugs(), rememberRecentSlug(), writeStoredRecentSlugs()

### Community 61 - "Community 61"
Cohesion: 0.29
Nodes (5): BrowserOpener, defaultBrowserOpener, createChild(), expectSpawnForPlatform(), spawnMock

### Community 62 - "Community 62"
Cohesion: 0.20
Nodes (10): annotateFlowchartConnector(), annotateFlowchartConnectorMarkers(), hasDistinctConnectorEndpoints(), hasUsableConnectorEndpoint(), readConnectorClassEndpoint(), readFlowchartConnectorClassName(), readFlowchartConnectorEndpoint(), readFlowchartConnectorEndpointFromClassNames() (+2 more)

### Community 63 - "Community 63"
Cohesion: 0.20
Nodes (10): hasDistinctEncodedEdgeIds(), hasEncodedEdgeIds(), isCompleteEncodedEdgeEndpoint(), readConnectorEndpointFromEncodedEdgeId(), readEncodedEdgeSourceId(), readEncodedEdgeTargetId(), readFlowchartConnectorEdgeId(), readFlowchartConnectorEndpointFromEdgeId() (+2 more)

### Community 64 - "Community 64"
Cohesion: 0.25
Nodes (7): compilerOptions, noEmit, outDir, paths, rootDir, extends, @diagram-tour/core

### Community 65 - "Community 65"
Cohesion: 0.29
Nodes (7): createGradient(), createGradientStop(), ensureGradient(), injectNodeGradients(), isDefsElement(), isLinearGradient(), readOrCreateDefs()

### Community 66 - "Community 66"
Cohesion: 0.33
Nodes (5): compilerOptions, noEmit, outDir, rootDir, extends

### Community 67 - "Community 67"
Cohesion: 0.40
Nodes (6): CLI Package, Core Package, Parser Package, Web Player Package, Keyboard Shortcuts Plan, Tour Specification v1

### Community 68 - "Community 68"
Cohesion: 0.60
Nodes (5): Install-BurntToastIfMissing(), Install-NuGetProviderIfMissing(), Show-BurntToast(), Show-MessageBoxFallback(), Show-TaskNotification()

### Community 69 - "Community 69"
Cohesion: 0.33
Nodes (5): dependencies, @diagram-tour/core, @diagram-tour/parser, mermaid, svelte-sonner

### Community 70 - "Community 70"
Cohesion: 0.40
Nodes (4): compilerOptions, noEmit, extends, include

### Community 71 - "Community 71"
Cohesion: 0.50
Nodes (3): sharedRules, typedGuardrailRules, config

### Community 72 - "Community 72"
Cohesion: 0.40
Nodes (5): normalizeRenderedSvg(), readNormalizedViewBoxSize(), readPositiveFiniteValue(), readViewBoxSize(), readViewBoxValues()

### Community 73 - "Community 73"
Cohesion: 0.80
Nodes (4): enterPreMode(), leavePreMode(), readCurrentTag(), runChangeset()

### Community 74 - "Community 74"
Cohesion: 0.83
Nodes (3): clampStepIndex(), load(), readInitialStepIndex()

### Community 76 - "Community 76"
Cohesion: 0.67
Nodes (3): Engineering Principles, Engineering Review Rubric, Architecture Reviewer Skill

## Knowledge Gaps
- **306 isolated node(s):** `$schema`, `access`, `baseBranch`, `changelog`, `commit` (+301 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **5 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `ResolvedDiagramTour` connect `Community 29` to `Community 0`, `Community 1`, `Community 32`, `Community 7`, `Community 55`, `Community 25`?**
  _High betweenness centrality (0.157) - this node is a cross-community bridge._
- **Why does `ResolvedDiagramTourCollectionEntry` connect `Community 11` to `Community 32`, `Community 37`, `Community 6`, `Community 7`, `Community 9`, `Community 48`?**
  _High betweenness centrality (0.145) - this node is a cross-community bridge._
- **Why does `loadResolvedTourCollection()` connect `Community 37` to `Community 32`, `Community 5`, `Community 9`, `Community 14`, `Community 19`, `Community 22`, `Community 24`, `Community 25`?**
  _High betweenness centrality (0.119) - this node is a cross-community bridge._
- **What connects `$schema`, `access`, `baseBranch` to the rest of the system?**
  _308 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.05701662108142226 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.05030864197530864 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.05462962962962963 - nodes in this community are weakly interconnected._