import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

interface Ingredient {
  name: string;
  quantity: string | null;
  unit: string | null;
  note: string | null;
}

interface RecipeStep {
  text: string;
  subSteps: string[];
}

interface RecipePdfProps {
  title: string;
  categoryName: string | null;
  description: string | null;
  source: string | null;
  servings: number;
  prepTime: number | null;
  cookTime: number | null;
  ingredients: Ingredient[];
  steps: RecipeStep[];
}

const s = StyleSheet.create({
  page: {
    paddingTop: 52,
    paddingBottom: 60,
    paddingLeft: 52,
    paddingRight: 52,
    fontFamily: 'Helvetica',
    backgroundColor: '#ffffff',
  },

  // ── Header ─────────────────────────────────────────────────────────────────
  title: {
    fontSize: 24,
    fontFamily: 'Helvetica-Bold',
    color: '#111111',
    marginBottom: 6,
  },
  servingsTag: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: '#444444',
    marginBottom: 4,
  },
  timeRow: {
    flexDirection: 'row' as const,
    gap: 20,
    marginBottom: 4,
  },
  timeTag: {
    fontSize: 9,
    color: '#666666',
  },
  categoryTag: {
    fontSize: 9,
    color: '#888888',
    marginBottom: 4,
  },
  sourceTag: {
    fontSize: 9,
    color: '#888888',
    marginBottom: 16,
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    marginBottom: 22,
  },
  description: {
    fontSize: 10,
    color: '#555555',
    marginBottom: 24,
  },

  // ── Section headers ─────────────────────────────────────────────────────────
  sectionHeader: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: '#999999',
    textTransform: 'uppercase',
    letterSpacing: 1.4,
    marginBottom: 10,
  },

  // ── Ingredients ─────────────────────────────────────────────────────────────
  ingredientsSection: {
    marginBottom: 28,
  },
  ingredientRow: {
    flexDirection: 'row',
    marginBottom: 9,
  },
  ingredientBullet: {
    fontSize: 10,
    color: '#bbbbbb',
    width: 14,
  },
  // Single Text block — name + optional note as inline child span
  ingredientText: {
    fontSize: 10,
    color: '#111111',
    flex: 1,
  },
  ingredientNoteSpan: {
    fontSize: 9,
    color: '#888888',
  },

  // ── Steps ───────────────────────────────────────────────────────────────────
  stepsSection: {},
  stepRow: {
    flexDirection: 'row',
    marginBottom: 16,
    alignItems: 'flex-start',
  },
  stepNum: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#999999',
    width: 22,
    paddingTop: 1,
  },
  stepContent: {
    flex: 1,
  },
  stepText: {
    fontSize: 10,
    color: '#111111',
    lineHeight: 1.5,
  },
  subStepRow: {
    flexDirection: 'row',
    marginTop: 5,
    marginLeft: 8,
  },
  subBullet: {
    fontSize: 9,
    color: '#bbbbbb',
    width: 14,
    paddingTop: 1,
  },
  subStepText: {
    fontSize: 9,
    color: '#555555',
    flex: 1,
    lineHeight: 1.4,
  },

  // ── Footer ──────────────────────────────────────────────────────────────────
  footer: {
    position: 'absolute',
    bottom: 28,
    left: 52,
    right: 52,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  footerText: {
    fontSize: 8,
    color: '#cccccc',
  },
});

function fmtTime(mins: number | null): string | null {
  if (mins == null || mins <= 0) return null;
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h} hr` : `${h} hr ${m} min`;
}

function qtyLabel(ing: Ingredient): string {
  const parts: string[] = [];
  if (ing.quantity) parts.push(ing.quantity);
  if (ing.unit) parts.push(ing.unit);
  return parts.join(' ');
}

export function RecipePdf({
  title,
  categoryName,
  description,
  source,
  servings,
  prepTime,
  cookTime,
  ingredients,
  steps,
}: RecipePdfProps) {
  const prep = fmtTime(prepTime);
  const cook = fmtTime(cookTime);
  return (
    <Document>
      <Page size="A4" style={s.page}>

        {/* Header */}
        <Text style={s.title}>{title}</Text>
        <Text style={s.servingsTag}>Serves {servings}</Text>
        {(prep || cook) ? (
          <View style={s.timeRow}>
            {prep ? <Text style={s.timeTag}>Prep: {prep}</Text> : null}
            {cook ? <Text style={s.timeTag}>Cook: {cook}</Text> : null}
          </View>
        ) : null}
        {categoryName ? <Text style={s.categoryTag}>{categoryName}</Text> : null}
        {source ? <Text style={s.sourceTag}>Source: {source}</Text> : null}

        <View style={s.divider} />

        {description ? <Text style={s.description}>{description}</Text> : null}

        {/* Ingredients */}
        <View style={s.ingredientsSection}>
          <Text style={s.sectionHeader}>Ingredients</Text>
          {ingredients.map((ing, i) => {
            const qty = qtyLabel(ing);
            const main = qty ? `${qty}  ${ing.name}` : ing.name;
            return (
              <View key={i} style={s.ingredientRow}>
                <Text style={s.ingredientBullet}>·</Text>
                {/*
                  Keep name + note in ONE Text block so react-pdf calculates
                  the combined height correctly — splitting into two sibling
                  Text elements inside a View causes height measurement bugs
                  that make them overlap.
                */}
                <Text style={s.ingredientText}>
                  {main}
                  {ing.note ? (
                    <Text style={s.ingredientNoteSpan}>{'\n'}{ing.note}</Text>
                  ) : null}
                </Text>
              </View>
            );
          })}
        </View>

        {/* Steps */}
        {steps.length > 0 && (
          <View style={s.stepsSection}>
            <Text style={s.sectionHeader}>Method</Text>
            {steps.map((step, i) => (
              <View key={i} style={s.stepRow} wrap={false}>
                <Text style={s.stepNum}>{i + 1}.</Text>
                <View style={s.stepContent}>
                  <Text style={s.stepText}>{step.text}</Text>
                  {step.subSteps.map((sub, j) => (
                    <View key={j} style={s.subStepRow}>
                      <Text style={s.subBullet}>–</Text>
                      <Text style={s.subStepText}>{sub}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Footer */}
        <View style={s.footer} fixed>
          <Text style={s.footerText}>{title}</Text>
          <Text
            style={s.footerText}
            render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
          />
        </View>

      </Page>
    </Document>
  );
}
